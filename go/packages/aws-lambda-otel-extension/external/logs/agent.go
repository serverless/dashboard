package logs

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/reporter"
	"aws-lambda-otel-extension/external/types"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
)

// DefaultHttpListenerPort is used to set the URL where the logs will be sent by Logs API
const LOGS_SERVER_PORT = "4243"

// LogsApiHttpListener is used to listen to the Logs API using HTTP
type LogsApiHttpListener struct {
	// logQueue is a synchronous queue and is used to put the received logs to be consumed later (see main)
	server             *fasthttp.Server
	logger             *lib.Logger
	reportAgent        *reporter.ReporterClient
	currentRequestData *reporter.CurrentRequestData
}

// NewLogsApiHttpListener returns a LogsApiHttpListener with the given log queue
func NewLogsApiHttpListener(reportAgent *reporter.ReporterClient, currentRequestData *reporter.CurrentRequestData) *LogsApiHttpListener {
	return &LogsApiHttpListener{
		logger:             lib.NewLogger(),
		reportAgent:        reportAgent,
		currentRequestData: currentRequestData,
	}
}

// Start initiates the server in a goroutine where the logs will be sent
func (s *LogsApiHttpListener) Start() bool {
	address := fmt.Sprintf("sandbox:%s", LOGS_SERVER_PORT)
	s.server = &fasthttp.Server{
		Handler: s.http_handler,
		Name:    "LogsApiHttpListener",
		ErrorHandler: func(ctx *fasthttp.RequestCtx, err error) {
			s.logger.Error("Error while handling logs", zap.Error(err))
		},
	}

	go s.server.ListenAndServe(address)
	s.logger.Debug("Started logs HTTP agent", zap.String("address", address))
	return true
}

// http_handler handles the requests coming from the Logs API.
// Everytime Logs API sends logs, this function will read the logs from the response body
// and put them into a synchronous queue to be read by the main goroutine.
// Logging or printing besides the error cases below is not recommended if you have subscribed to receive extension logs.
// Otherwise, logging here will cause Logs API to send new logs for the printed lines which will create an infinite loop.
func (s *LogsApiHttpListener) http_handler(ctx *fasthttp.RequestCtx) {
	body := ctx.Request.Body()

	msgs, err := reporter.ParseLogsAPIPayload(body)
	if err != nil {
		s.logger.Error("Error parsing logs api payload", zap.Error(err))
		return
	}

	var typeFunctions []reporter.LogMessage
	for _, msg := range msgs {
		if msg.LogType == types.LogTypeFunction && !strings.Contains(msg.StringRecord, "SERVERLESS_ENTERPRISE") {
			typeFunctions = append(typeFunctions, msg)
		}
	}
	if len(typeFunctions) > 0 {
		s.currentRequestData.SendLogs(typeFunctions)
	}

	if err != nil {
		s.logger.Error("Error getting last telemetry data", zap.Error(err))
	}

	for _, msg := range msgs {
		switch msg.LogType {
		case types.LogTypePlatformStart:
			s.currentRequestData.SetUniqueName("start")
		case types.LogTypePlatformRuntimeDone:
			if msg.ObjectRecord.RuntimeDoneItem != "success" && s.currentRequestData.GetLastTelemetryData() != nil {
				s.currentRequestData.SaveLastTelemetryData()
			}
			s.logger.Debug("Logs api agent received runtime done", zap.String("runtime_done_item", msg.ObjectRecord.RuntimeDoneItem))
			s.reportAgent.SetDone()
		case types.LogTypePlatformReport:
			if s.currentRequestData.GetLastTelemetryData() == nil {
				s.currentRequestData.LoadLastTelemetryData()
			}
			s.logger.Debug(fmt.Sprintf("LogTypePlatformReport to send report (%v)", s.currentRequestData.GetLastTelemetryData()))
			if s.currentRequestData.GetLastTelemetryData() != nil {
				metrics := reporter.CreateMetricsPayload(msg.ObjectRecord.RequestID, *s.currentRequestData.GetLastTelemetryData(), &msg.ObjectRecord)
				s.reportAgent.PostMetrics(metrics)
			}
		}
	}

	// fmt.Println("Logs API event received:", string(body))

	// Send all transform process to run in a go routine

	if err != nil {
		s.logger.Error("Can't push logs to destination", zap.Error(err))
	}
}

// Shutdown terminates the HTTP server listening for logs
func (s *LogsApiHttpListener) Shutdown(ctx context.Context) {
	if s.server != nil {
		err := s.server.Shutdown()
		if err != nil {
			s.logger.Error("Failed to shutdown http server gracefully ", zap.Error(err))
		} else {
			s.server = nil
		}
	}
}

// HttpAgent has the listener that receives the logs and the logger that handles the received logs
type HttpAgent struct {
	listener           *LogsApiHttpListener
	logger             *lib.Logger
	CurrentRequestData *reporter.CurrentRequestData
	settings           *lib.UserSettings
}

// NewLogsApiAgent returns an agent to listen and handle logs coming from Logs API for HTTP
// Make sure the agent is initialized by calling Init(agentId) before subscription for the Logs API.
func NewLogsApiAgent(reportAgent *reporter.ReporterClient, currentRequestData *reporter.CurrentRequestData, settings *lib.UserSettings) (*HttpAgent, error) {
	logsApiListener := NewLogsApiHttpListener(reportAgent, currentRequestData)

	return &HttpAgent{
		listener:           logsApiListener,
		logger:             lib.NewLogger(),
		CurrentRequestData: currentRequestData,
		settings:           settings,
	}, nil
}

// Init initializes the configuration for the Logs API and subscribes to the Logs API for HTTP
func (h HttpAgent) Init(agentID string) error {
	extensions_api_address, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
	if !ok {
		return errors.New("AWS_LAMBDA_RUNTIME_API is not set")
	}

	logsApiBaseUrl := fmt.Sprintf("http://%s", extensions_api_address)

	logsApiClient, err := NewClient(logsApiBaseUrl)
	if err != nil {
		return err
	}

	_ = h.listener.Start()

	eventTypes := []types.LogEventType{types.LogTypePlatform}

	if !h.settings.Logs.Disabled {
		eventTypes = append(eventTypes, types.LogTypeFunction)
	}
	bufferingCfg := BufferingCfg{
		MaxItems:  10000,
		MaxBytes:  262144,
		TimeoutMS: 25,
	}
	if err != nil {
		return err
	}
	destination := Destination{
		Protocol:   HttpProto,
		URI:        URI(fmt.Sprintf("http://sandbox:%s", LOGS_SERVER_PORT)),
		HttpMethod: HttpPost,
		Encoding:   JSON,
	}

	_, err = logsApiClient.Subscribe(eventTypes, bufferingCfg, destination, agentID)
	return err
}

// Shutdown finalizes the logging and terminates the listener
func (a *HttpAgent) Shutdown(ctx context.Context) {
	a.logger.Sync()
	a.listener.Shutdown(ctx)
}
