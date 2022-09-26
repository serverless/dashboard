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

	"github.com/golang-collections/go-datastructures/queue"
	"go.uber.org/zap"
)

// INITIAL_QUEUE_SIZE is the initial size set for the synchronous logQueue
const INITIAL_QUEUE_SIZE = 5

func ExternalExtension() {
	lib.ReportInitialization()
	startTime := time.Now()
	logger := lib.NewLogger()
	extensionName := path.Base(os.Args[0])
	printPrefix := fmt.Sprintf("[%s]", extensionName)
	extensionClient := extension.NewClient(os.Getenv("AWS_LAMBDA_RUNTIME_API"))

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
	flushLogQueue := func(force bool) {
		for !(logQueue.Empty() && (force || receivedRuntimeDone)) {
			logs, err := logQueue.Get(1)
			if err != nil {
				logger.Error(printPrefix, zap.Error(err))
				return
			}
			logsStr := fmt.Sprintf("%v", logs[0])
			receivedRuntimeDone = strings.Contains(logsStr, string(logsapi.RuntimeDone)) || receivedRuntimeDone
			var arr []agent.LogItem
			if err := json.Unmarshal([]byte(logs[0].(string)), &arr); err != nil {
				continue
			}
			if requestId == "" {
				requestId = agent.FindRequestId(arr)
			}
			// Send to dev mode
			agent.ForwardLogs(arr, requestId)
		}
		// Reset request id just incase
		requestId = ""
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
				// Overhead duration log for benchmarks
				lib.ReportOverheadDuration(startTime)
			}
		}
	}
}

func main() {
	ExternalExtension()
}
