package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

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

	logger.Debug("Starting external extension")

	reportAgent := reporter.NewReporterClient(&userSettings)
	currentRequestData := reporter.NewCurrentRequestData(reportAgent)

	// Create Logs API agent
	logsApiAgent, err := logs.NewLogsApiAgent(reportAgent, currentRequestData, &userSettings)
	if err != nil {
		logger.Fatal("couldnt create logs api agent", zap.Error(err))
	}

	// Track OS signals to gracefully shutdown
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		s := <-sigs
		cancel()
		logger.Debug(fmt.Sprintf("Received signal: %s, Exiting", s))
	}()

	// Create metrics agent/listener
	metricsApiListener := metrics.NewInternalHttpListener(reportAgent, currentRequestData)
	metricsApiListener.Start()

	// Register the extension
	err = extensionClient.Register(ctx)
	if err != nil {
		panic(err)
	}

	// Subscribe to logs API
	// Logs start being delivered only after the subscription happens.
	// go func() {
	err = logsApiAgent.Init(extensionClient.ExtensionID)
	if err != nil {
		logger.Fatal("couldnt init logs api agent", zap.Error(err))
	}
	// }()

	// Will block until shutdown event is received or cancelled via the context.
	logger.Debug("Going to process events loop")

	// first call init next/event
	processEvents(ctx, logger, reportAgent, currentRequestData)

	logger.Debug("Exiting")
	logsApiAgent.Shutdown(ctx)
	metricsApiListener.Shutdown()
	err = reportAgent.Shutdown()
	if err != nil {
		logger.Error("Failed to shutdown report agent", zap.Error(err))
	}

	return
}

func processEvents(ctx context.Context, logger *lib.Logger, reportAgent *reporter.ReporterClient, currentRequestData *reporter.CurrentRequestData) {

	next := func() error {
		res, err := extensionClient.NextEvent(ctx)
		if err != nil {
			logger.Error(fmt.Sprintf("Error event: %s, Exiting", err))
			return err
		}
		// Exit if we receive a SHUTDOWN event
		if res.EventType == extension.Shutdown {
			logger.Debug("Received SHUTDOWN event, Exiting")
			return err
		} else if res.EventType == extension.Invoke {
			currentRequestData.SetUniqueName("invoke")
			logger.Debug("Invoke received")
		}
		return nil
	}

	// first next to flag we're ready
	if err := next(); err != nil {
		return
	}

	for {
		// block until we receive runtimeDone
		reportAgent.WaitDone()
		reportAgent.WaitRequests(time.Millisecond * 1000)
		select {
		case <-ctx.Done():
			logger.Debug("Context cancelled, exiting")
			return
		default:
			logger.Debug("Reading next event...")
			if err := next(); err != nil {
				return
			}
		}
	}
}
