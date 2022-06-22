package metrics

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/reporter"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"go.uber.org/zap"
)

const OTEL_SERVER_PORT = "2772"

type TelemetryPayload struct {
	RecordType string `json:"recordType"`
}

// InternalHttpClient is a simple client for the OTEL server
type InternalHttpListener struct {
	httpServer *http.Server
	// metricsQueue is a synchronous queue and is used to put the received metrics to be consumed later (see main)
	reportAgent *reporter.HttpClient
	logger      *lib.Logger
}

func NewInternalHttpListener(reportAgent *reporter.HttpClient) *InternalHttpListener {
	return &InternalHttpListener{
		httpServer:  nil,
		reportAgent: reportAgent,
		logger:      lib.NewLogger(),
	}
}

// Start initiates the server in a goroutine
func (l *InternalHttpListener) Start() bool {
	address := fmt.Sprintf("sandbox:%s", OTEL_SERVER_PORT)
	l.httpServer = &http.Server{Addr: address}
	http.HandleFunc("/", l.http_handler)
	go func() {
		l.logger.Info("Serving internal agent on address: " + address)
		err := l.httpServer.ListenAndServe()
		if err != http.ErrServerClosed {
			l.logger.Error("Unexpected stop on Http Server", zap.Error(err))
			l.Shutdown()
		} else {
			l.logger.Error("Http Server closed", zap.Error(err))
		}
	}()
	return true
}

// http_handler handles the requests coming from the Internal API.
// Everytime Internal API sends metrics, this function will read the metrics from the response body
// and put them into a synchronous queue to be read by the main goroutine.
// Logging or printing besides the error cases below is not recommended if you have subscribed to receive extension metrics.
// Otherwise, logging here will cause Logs API to send new logs for the printed lines which will create an infinite loop.
func (l *InternalHttpListener) http_handler(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		l.logger.Error("Error reading body", zap.Error(err))
		return
	}

	// fmt.Println("Internal API event received:", string(body))

	// Puts the message into the queue
	// err = l.queue.Put(string(body))

	l.reportAgent.PostMetric(string(body))
	if err != nil {
		l.logger.Error("Can't push logs to destination", zap.Error(err))
	}
}

// Shutdown terminates the HTTP server
func (l *InternalHttpListener) Shutdown() {
	if l.httpServer != nil {
		ctx, _ := context.WithTimeout(context.Background(), 1*time.Second)
		err := l.httpServer.Shutdown(ctx)
		if err != nil {
			l.logger.Error("Failed to shutdown http server gracefully ", zap.Error(err))
		} else {
			l.httpServer = nil
		}
	}
}
