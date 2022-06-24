package logs

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/reporter"
	"aws-lambda-otel-extension/external/types"
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"go.uber.org/zap"
)

// DefaultHttpListenerPort is used to set the URL where the logs will be sent by Logs API
const LOGS_SERVER_PORT = "4243"

// LogsApiHttpListener is used to listen to the Logs API using HTTP
type LogsApiHttpListener struct {
	httpServer *http.Server
	// logQueue is a synchronous queue and is used to put the received logs to be consumed later (see main)
	logger             *lib.Logger
	reportAgent        *reporter.HttpClient
	currentRequestData *reporter.CurrentRequestData
}

// NewLogsApiHttpListener returns a LogsApiHttpListener with the given log queue
func NewLogsApiHttpListener(reportAgent *reporter.HttpClient, currentRequestData *reporter.CurrentRequestData) *LogsApiHttpListener {
	return &LogsApiHttpListener{
		httpServer:         nil,
		logger:             lib.NewLogger(),
		reportAgent:        reportAgent,
		currentRequestData: currentRequestData,
	}
}

// Start initiates the server in a goroutine where the logs will be sent
func (s *LogsApiHttpListener) Start() bool {
	address := fmt.Sprintf("sandbox:%s", LOGS_SERVER_PORT)
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.http_handler)
	s.httpServer = &http.Server{Addr: address, Handler: mux}

	go func() {
		s.logger.Info("Serving logsapi agent on address: " + address)
		err := s.httpServer.ListenAndServe()
		if err != http.ErrServerClosed {
			s.logger.Error("Unexpected stop on Logsapi Http Server", zap.Error(err))
			s.Shutdown(context.Background())
		} else {
			s.logger.Debug("Http Server closed", zap.Error(err))
		}
	}()
	return true
}

// http_handler handles the requests coming from the Logs API.
// Everytime Logs API sends logs, this function will read the logs from the response body
// and put them into a synchronous queue to be read by the main goroutine.
// Logging or printing besides the error cases below is not recommended if you have subscribed to receive extension logs.
// Otherwise, logging here will cause Logs API to send new logs for the printed lines which will create an infinite loop.
func (s *LogsApiHttpListener) http_handler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		s.logger.Error("Error reading body", zap.Error(err))
		return
	}

	s.currentRequestData.SendLog(body)

	// fmt.Println("Logs API event received:", string(body))

	// Send all transform process to run in a go routine

	if err != nil {
		s.logger.Error("Can't push logs to destination", zap.Error(err))
	}
}

// Shutdown terminates the HTTP server listening for logs
func (s *LogsApiHttpListener) Shutdown(ctx context.Context) {
	if s.httpServer != nil {
		err := s.httpServer.Shutdown(ctx)
		if err != nil {
			s.logger.Error("Failed to shutdown http server gracefully ", zap.Error(err))
		} else {
			s.httpServer = nil
		}
	}
}

// HttpAgent has the listener that receives the logs and the logger that handles the received logs
type HttpAgent struct {
	listener           *LogsApiHttpListener
	logger             *lib.Logger
	CurrentRequestData *reporter.CurrentRequestData
}

// NewLogsApiAgent returns an agent to listen and handle logs coming from Logs API for HTTP
// Make sure the agent is initialized by calling Init(agentId) before subscription for the Logs API.
func NewLogsApiAgent(reportAgent *reporter.HttpClient) (*HttpAgent, error) {
	currentRequestData := reporter.NewCurrentRequestData(reportAgent)
	logsApiListener := NewLogsApiHttpListener(reportAgent, currentRequestData)

	return &HttpAgent{
		listener:           logsApiListener,
		logger:             lib.NewLogger(),
		CurrentRequestData: currentRequestData,
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

	eventTypes := []types.LogEventType{types.LogPlatform, types.LogFunction}
	bufferingCfg := BufferingCfg{
		MaxItems:  10000,
		MaxBytes:  262144,
		TimeoutMS: 1000,
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
	// err := a.logger.Shutdown()
	// if err != nil {
	// 	a.logger.Errorf("Error when trying to shutdown logger: %v", err)
	// }

	a.listener.Shutdown(ctx)
}
