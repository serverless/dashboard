package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path"
	"serverless/dev-mode-extension/agent"
	"serverless/dev-mode-extension/extension"
	"serverless/dev-mode-extension/lib"
	"serverless/dev-mode-extension/logsapi"
	"strings"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/sts/stsiface"
	"github.com/golang-collections/go-datastructures/queue"
	"go.uber.org/zap"
)

// INITIAL_QUEUE_SIZE is the initial size set for the synchronous logQueue
const INITIAL_QUEUE_SIZE = 5

var AWS_ACCOUNT_ID = ""
var logger = lib.NewLogger()

func getAccountId(svc stsiface.STSAPI) {
	input := &sts.GetCallerIdentityInput{}
	callerIdentity, stsErr := svc.GetCallerIdentity(input)
	if stsErr != nil {
		logger.Error("Failed to get account id", zap.Error(stsErr))
	} else {
		AWS_ACCOUNT_ID = *callerIdentity.Account
	}
}

type Extension struct {
	Client stsiface.STSAPI
}

func (e *Extension) ExternalExtension() {
	lib.ReportInitialization()
	startTime := time.Now()
	extensionName := path.Base(os.Args[0])
	printPrefix := fmt.Sprintf("[%s]", extensionName)
	extensionClient := extension.NewClient(os.Getenv("AWS_LAMBDA_RUNTIME_API"))

	// Print environment variables

	// Get account id from sts
	getAccountId(e.Client)

	ctx, cancel := context.WithCancel(context.Background())

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		s := <-sigs
		cancel()
		s.String()
	}()

	// Register extension as soon as possible
	_, err := extensionClient.Register(ctx, extensionName)
	if err != nil {
		panic(err)
	}

	// A synchronous queue that is used to put logs from the goroutine (producer)
	// and process the logs from main goroutine (consumer)
	logQueue := queue.New(INITIAL_QUEUE_SIZE)
	// Helper function to empty the log queue
	var receivedRuntimeDone bool = false
	var requestId string = ""
	var traceId string = ""
	// Save init report duration so we can send it as part of the req dev mode payload on the init_duration_ms
	var initReport *agent.LogItem = nil
	// Save response log so we can combine it with the runtimeDone event to include additional telemetry data
	var responseLog *agent.LogItem = nil

	deferredLogs := []agent.LogItem{}

	wrapper := os.Getenv("AWS_LAMBDA_EXEC_WRAPPER")
	hasInternalExtension := wrapper == "/opt/sls-sdk-node/exec-wrapper.sh"

	// Save the res payload from the SDK so we can send it out at runtime done so we can include the
	// runtime_duration_ms & runtime_response_latency_ms that is included in the runtime done event
	flushLogQueue := func(force bool) {
		for !(logQueue.Empty() && (force || receivedRuntimeDone)) {
			logs, err := logQueue.Get(1)
			if err != nil {
				logger.Error(printPrefix, zap.Error(err))
				return
			}
			logsStr := fmt.Sprintf("%v", logs[0])
			receivedRuntimeDone = strings.Contains(logsStr, string(logsapi.RuntimeDone)) || receivedRuntimeDone
			lib.Info(logsStr)
			var arr []agent.LogItem
			if err := json.Unmarshal([]byte(logs[0].(string)), &arr); err != nil {
				continue
			}

			// Save init report
			// else add metadata to req report before sending to backend
			if initReport == nil {
				value := agent.FindInitReport(arr)
				if value != nil {
					initReport = value
				}
			} else {
				value := agent.FindReqData(arr)
				if value != nil {
					for index, log := range arr {
						if log.LogType == "reqRes" {
							arr[index].Metadata = initReport
							break
						}
					}
				}
			}

			runtimeDoneLog := agent.FindRuntimeDone(arr)

			// Save Res Report and skip
			// else we send res report to backend and continue
			if responseLog == nil {
				value := agent.FindResData(arr)
				if value != nil {
					responseLog = value
					continue
				}
			} else if receivedRuntimeDone {
				value := runtimeDoneLog
				arr = append(arr, agent.LogItem{
					Time:     responseLog.Time,
					LogType:  responseLog.LogType,
					Record:   responseLog.Record,
					Metadata: value,
				})
			}

			if requestId == "" {
				requestId = agent.FindRequestId(arr)
			}

			// Find the trace id so we can attach it to incoming logs
			if traceId == "" && os.Getenv("SLS_ORG_ID") != "" {
				traceId = agent.FindTraceId(arr)
			}

			if runtimeDoneLog != nil {
				record := runtimeDoneLog.Record.(map[string]interface{})
				rId := record["requestId"].(string)
				finalStatus := record["status"].(string)
				if requestId == "" {
					requestId = rId
				}
				// TraceId will never come because there was a runtime error
				if finalStatus == "error" && traceId == "" && hasInternalExtension {
					traceId = rId
				}
			}

			if traceId == "" && hasInternalExtension {
				deferredLogs = append(deferredLogs, arr...)
				continue
			} else if requestId == "" {
				deferredLogs = append(deferredLogs, arr...)
				continue
			}

			// Add deferred logs to array
			if len(deferredLogs) > 0 {
				for _, log := range deferredLogs {
					arr = append(arr, log)
				}
				deferredLogs = []agent.LogItem{}
			}

			// Send to dev mode if we have requestId and traceId
			agent.ForwardLogs(arr, requestId, AWS_ACCOUNT_ID, traceId)
		}
		// Force send logs at end of loop
		if len(deferredLogs) > 0 {
			agent.ForwardLogs(deferredLogs, requestId, AWS_ACCOUNT_ID, traceId)
		}

		initReport = nil
		responseLog = nil
	}

	// Create Logs API agent
	logsApiAgent, err := agent.NewHttpAgent(logQueue, logger)
	if err != nil {
		logger.Fatal("Failed to create logsAPIAgent", zap.Error(err))
	}

	// Subscribe to logs API
	// Logs start being delivered only after the subscription happens.
	agentID := extensionClient.ExtensionID
	err = logsApiAgent.Init(agentID)
	if err != nil {
		logger.Fatal("Failed to create logs agent", zap.Error(err))
	}

	// Init duration log for benchmarks
	lib.ReportInitDuration(startTime)

	// Will block until invoke or shutdown event is received or cancelled via the context.
	for {
		select {
		case <-ctx.Done():
		// 	return
		default:
			// This is a blocking call
			res, err := extensionClient.NextEvent(ctx)
			if err != nil {
				return
			}

			// Exit if we receive a SHUTDOWN event
			if res.EventType == extension.Shutdown {
				flushLogQueue(true)
				logsApiAgent.Shutdown()
				// Shutdown duration log for benchmarks
				lib.ReportShutdownDuration(startTime)
				return
			} else {
				receivedRuntimeDone = false
				// Flush log queue in here after waking up
				flushLogQueue(false)
				traceId = ""
				requestId = ""
				// Overhead duration log for benchmarks
				lib.ReportOverheadDuration(startTime)
			}
		}
	}
}

func main() {
	stsSession := session.Must(session.NewSession())
	svc := sts.New(stsSession)
	ext := Extension{
		Client: svc,
	}
	ext.ExternalExtension()
}
