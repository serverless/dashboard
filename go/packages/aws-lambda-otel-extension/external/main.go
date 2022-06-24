package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"aws-lambda-otel-extension/external/extension"
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/logs"
	"aws-lambda-otel-extension/external/metrics"
	"aws-lambda-otel-extension/external/reporter"

	"go.uber.org/zap"
)

var (
	extensionClient = extension.NewClient(os.Getenv("AWS_LAMBDA_RUNTIME_API"))
)

// INITIAL_QUEUE_SIZE is the initial size set for the synchronous logQueue
const INITIAL_QUEUE_SIZE = 100

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	// wg := new(sync.WaitGroup)
	logger := lib.NewLogger()
	defer logger.Sync()
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

	// Create Logs API agent
	logsApiAgent, err := logs.NewLogsApiAgent(reportAgent)
	if err != nil {
		logger.Fatal("couldnt create logs api agent", zap.Error(err))
	}

	// Subscribe to logs API
	// Logs start being delivered only after the subscription happens.
	// go func() {
	agentID := extensionClient.ExtensionID
	logger.Info("Subscribing to logs API", zap.String("agentID", agentID))
	err = logsApiAgent.Init(agentID)
	if err != nil {
		logger.Fatal("couldnt init logs api agent", zap.Error(err))
	}
	// }()

	// Will block until shutdown event is received or cancelled via the context.
	logger.Info("Going to process events loop")
	processEvents(ctx, logger, reportAgent)

	logger.Info("Exiting")
	logsApiAgent.Shutdown(ctx)
	metricsApiListener.Shutdown()
	err = reportAgent.Shutdown()
	if err != nil {
		logger.Error("Failed to shutdown report agent", zap.Error(err))
	}

	return
}

func processEvents(ctx context.Context, logger *lib.Logger, reportAgent *reporter.HttpClient) {
	for {
		select {
		case <-ctx.Done():
			logger.Debug("Context cancelled, exiting")
			return
		default:
			logger.Debug("Waiting for an event...")
			res, err := extensionClient.NextEvent(ctx)
			reportAgent.Flush()
			if err != nil {
				logger.Error(fmt.Sprintf("Error event: %s, Exiting", err))
				return
			}
			// Exit if we receive a SHUTDOWN event
			if res.EventType == extension.Shutdown {
				logger.Debug("Received SHUTDOWN event, Exiting")
				return
			} else {
				logger.Debug(fmt.Sprintf("Received generic event: %s", lib.PrettyPrint(res)))
			}
		}
	}
}
