package metrics

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/reporter"
	"fmt"

	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
)

const OTEL_SERVER_PORT = "2772"

type TelemetryPayload struct {
	RecordType string `json:"recordType"`
}

// InternalHttpClient is a simple client for the OTEL server
type InternalHttpListener struct {
	server *fasthttp.Server
	// metricsQueue is a synchronous queue and is used to put the received metrics to be consumed later (see main)
	reportAgent        *reporter.ReporterClient
	currentRequestData *reporter.CurrentRequestData
	logger             *lib.Logger
}

func NewInternalHttpListener(reportAgent *reporter.ReporterClient, currentRequestData *reporter.CurrentRequestData) *InternalHttpListener {
	return &InternalHttpListener{
		reportAgent:        reportAgent,
		logger:             lib.NewLogger(),
		currentRequestData: currentRequestData,
	}
}

// Start initiates the server in a goroutine
func (l *InternalHttpListener) Start() bool {
	address := fmt.Sprintf("localhost:%s", OTEL_SERVER_PORT)
	l.server = &fasthttp.Server{
		Handler: l.http_handler,
		Name:    "MetricsHttpAgent",
		ErrorHandler: func(ctx *fasthttp.RequestCtx, err error) {
			l.logger.Error("Error while handling logs", zap.Error(err))
		},
	}

	go l.server.ListenAndServe(address)
	l.logger.Debug("Started metrics HTTP agent", zap.String("address", address))
	return true
}

// http_handler handles the requests coming from the Internal API.
func (l *InternalHttpListener) http_handler(ctx *fasthttp.RequestCtx) {
	body := ctx.Request.Body()

	l.logger.Debug("Received metrics", zap.String("body", string(body)))

	// fmt.Println("Internal API event received:", string(body))

	payload, err := reporter.ParseInternalPayload(body)
	if err != nil {
		l.logger.Error("Error parsing payload", zap.Error(err))
		return
	}

	switch payload.RecordType {
	case "eventData":
		eventData, err := reporter.ParseEventDataPayload(payload.Record)
		if err != nil {
			l.logger.Error("Error parsing payload", zap.Error(err))
			return
		}
		l.currentRequestData.SetUniqueName("request")
		l.currentRequestData.SetEventData(eventData)
		if eventData.RequestEventPayload != nil {
			l.reportAgent.PostRequest(*eventData.RequestEventPayload)
		}
		return

	case "telemetryData":
		telemetryData, err := reporter.ParseTelemetryDataPayload(payload.Record)
		if err != nil {
			l.logger.Error("Error parsing payload", zap.Error(err))
			return
		}
		if telemetryData.ResponseEventPayload != nil {
			l.reportAgent.PostResponse(*telemetryData.ResponseEventPayload)
		}
		l.currentRequestData.SetLastTelemetryData(&telemetryData.Function)
		metrics := reporter.CreateMetricsPayload(telemetryData.RequestID, telemetryData.Function, nil)

		l.reportAgent.PostMetrics(metrics)

		traces, err := reporter.CreateTracePayload(telemetryData.RequestID, telemetryData.Function, telemetryData.Traces)
		if err != nil {
			l.logger.Error("Error creating traces", zap.Error(err))
			return
		}
		l.reportAgent.PostTrace(traces)

	default:
		l.logger.Error("Unknown payload type", zap.String("payload", string(body)))
	}
}

// Shutdown terminates the HTTP server
func (l *InternalHttpListener) Shutdown() {
	if l.server != nil {
		l.server.Shutdown()
	}
}
