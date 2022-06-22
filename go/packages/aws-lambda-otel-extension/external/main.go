package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"aws-lambda-otel-extension/external/extension"
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/logs"
	"aws-lambda-otel-extension/external/metrics"
	"aws-lambda-otel-extension/external/reporter"

	"github.com/golang-collections/go-datastructures/queue"
	"go.uber.org/zap"
)

var (
	extensionClient = extension.NewClient(os.Getenv("AWS_LAMBDA_RUNTIME_API"))
)

// INITIAL_QUEUE_SIZE is the initial size set for the synchronous logQueue
const INITIAL_QUEUE_SIZE = 100

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	logger := lib.NewLogger()
	userSettings, err := lib.GetUserSettings()
	if err != nil {
		logger.Error("Failed to get user settings", zap.Error(err))
		return
	}

	logger.Info("Starting external extension")

	reportAgent := reporter.NewHttpClient(&userSettings)

	// Start listening metrics
	metricsApiListener := metrics.NewInternalHttpListener(reportAgent)
	metricsApiListener.Start()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		s := <-sigs
		cancel()
		logger.Debug(fmt.Sprintf("Received signal: %s, Exiting", s))
	}()

	// Register the extension
	_, err = extensionClient.Register(ctx)
	if err != nil {
		panic(err)
	}

	// A synchronous queue that is used to put logs from the goroutine (producer)
	// and process the logs from main goroutine (consumer)
	logQueue := queue.New(INITIAL_QUEUE_SIZE)
	// Helper function to empty the log queue
	var logsStr string = ""
	flushLogQueue := func(force bool) {
		for !(logQueue.Empty() && (force || strings.Contains(logsStr, string(logs.RuntimeDone)))) {
			logs, err := logQueue.Get(1)
			if err != nil {
				logger.Error("flush error", zap.Error(err))
				return
			}
			logsStr = fmt.Sprintf("queue print - %v", logs[0])
			fmt.Println(logsStr)
			// err = logsApiLogger.PushLog(logsStr)
			// if err != nil {
			// 	logger.Error(printPrefix, err)
			// 	return
			// }
		}
	}

	// Create Logs API agent
	logsApiAgent, err := logs.NewLogsApiAgent(logQueue)
	if err != nil {
		logger.Fatal("couldnt create logs api agent", zap.Error(err))
	}

	// Subscribe to logs API
	// Logs start being delivered only after the subscription happens.
	agentID := extensionClient.ExtensionID
	err = logsApiAgent.Init(agentID)
	if err != nil {
		logger.Fatal("couldnt init logs api agent", zap.Error(err))
	}

	// Will block until shutdown event is received or cancelled via the context.
	for {
		select {
		case <-ctx.Done():
			return
		default:
			res, err := extensionClient.NextEvent(ctx)
			if err != nil {
				logger.Error(fmt.Sprintf("Error event: %s, Exiting", err))
				return
			}
			// Flush log queue in here after waking up
			flushLogQueue(false)
			// Exit if we receive a SHUTDOWN event
			if res.EventType == extension.Shutdown {
				logger.Debug("Received SHUTDOWN event, Exiting")
				flushLogQueue(true)
				logsApiAgent.Shutdown()
				return
			} else {
				logger.Debug(fmt.Sprintf("Received event: %s", lib.PrettyPrint(res)))
			}
		}
	}
}
