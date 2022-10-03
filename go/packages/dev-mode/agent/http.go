package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"serverless/dev-mode-extension/logsapi"

	"github.com/golang-collections/go-datastructures/queue"
	"go.uber.org/zap"
)

// DefaultHttpListenerPort is used to set the URL where the logs will be sent by Logs API
const DefaultHttpListenerPort = "1234"
const DefaultSDKHttpListenerPort = "2772"

// LogsApiHttpListener is used to listen to the Logs API using HTTP
type LogsApiHttpListener struct {
	httpServer *http.Server
	// http server for sdk communication
	sdkHttpServer *http.Server
	// logQueue is a synchronous queue and is used to put the received logs to be consumed later (see main)
	logQueue *queue.Queue
	// logger
	logger *zap.Logger
}

// NewLogsApiHttpListener returns a LogsApiHttpListener with the given log queue
func NewLogsApiHttpListener(lq *queue.Queue, l *zap.Logger) (*LogsApiHttpListener, error) {

	return &LogsApiHttpListener{
		httpServer:    nil,
		sdkHttpServer: nil,
		logQueue:      lq,
		logger:        l,
	}, nil
}

func ListenOnAddress() string {
	env_aws_local, ok := os.LookupEnv("SLS_TEST_EXTENSION")
	if ok && env_aws_local == "1" {
		return "127.0.0.1:" + DefaultHttpListenerPort
	}
	return "sandbox:" + DefaultHttpListenerPort
}

func SdkListenOnAddress() string {
	env_aws_local, ok := os.LookupEnv("SLS_TEST_EXTENSION")
	if ok && env_aws_local == "1" {
		return "127.0.0.1:" + DefaultSDKHttpListenerPort
	}
	return "localhost:" + DefaultSDKHttpListenerPort
}

// Start initiates the server in a goroutine where the logs will be sent
func (s *LogsApiHttpListener) Start() (bool, error) {
	address := ListenOnAddress()
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.http_handler)
	s.httpServer = &http.Server{Addr: address, Handler: mux}

	sdkAddress := SdkListenOnAddress()
	sdkMux := http.NewServeMux()
	sdkMux.HandleFunc("/spans", s.span_http_handler)
	sdkMux.HandleFunc("/reqres", s.req_res_http_handler)
	s.sdkHttpServer = &http.Server{Addr: sdkAddress, Handler: sdkMux}

	go func() {
		err := s.httpServer.ListenAndServe()
		if err != http.ErrServerClosed {
			s.Shutdown()
		}
	}()

	go func() {
		err := s.sdkHttpServer.ListenAndServe()
		if err != http.ErrServerClosed {
			s.Shutdown()
		}
	}()

	return true, nil
}

// http_handler handles the requests coming from the Logs API.
// Everytime Logs API sends logs, this function will read the logs from the response body
// and put them into a synchronous queue to be read by the main goroutine.
// Logging or printing besides the error cases below is not recommended if you have subscribed to receive extension logs.
// Otherwise, logging here will cause Logs API to send new logs for the printed lines which will create an infinite loop.
func (h *LogsApiHttpListener) http_handler(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		h.logger.Error("Error reading body", zap.Error(err))
		return
	}

	// Puts the log message into the queue
	logSet := string(body)
	err = h.logQueue.Put(logSet)
	if err != nil {
		h.logger.Error("Can't push logs to destination", zap.Error(err))
	}
}

func (h *LogsApiHttpListener) span_http_handler(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		h.logger.Error("Error reading body", zap.Error(err))
		return
	}

	spanPayload := []LogItem{{
		LogType: "spans",
		Record:  string(body),
	}}

	spanString, _ := json.Marshal(spanPayload)
	// Puts the log message into the queue
	logSet := string(spanString)
	fmt.Println("Span str", logSet)
	err = h.logQueue.Put(logSet)
	if err != nil {
		h.logger.Error("Can't push spans to destination", zap.Error(err))
	}
}

func (h *LogsApiHttpListener) req_res_http_handler(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		h.logger.Error("Error reading body", zap.Error(err))
		return
	}

	t, _ := time.Now().MarshalText()
	reqResPayload := []LogItem{{
		Time:    string(t),
		LogType: "reqRes",
		Record:  string(body),
	}}

	reqResString, _ := json.Marshal(reqResPayload)
	// Puts the log message into the queue
	logSet := string(reqResString)
	fmt.Println("ReqRes str", logSet)
	err = h.logQueue.Put(logSet)
	if err != nil {
		h.logger.Error("Can't push reqRes to destination", zap.Error(err))
	}
}

// Shutdown terminates the HTTP server listening for logs
func (s *LogsApiHttpListener) Shutdown() {
	if s.httpServer != nil {
		ctx, _ := context.WithTimeout(context.Background(), 4*time.Second)
		err := s.httpServer.Shutdown(ctx)
		if err != nil {
			s.logger.Error("Failed to shutdown http server gracefully", zap.Error(err))
		} else {
			s.httpServer = nil
		}
	}

	if s.sdkHttpServer != nil {
		ctx, _ := context.WithTimeout(context.Background(), 4*time.Second)
		err := s.sdkHttpServer.Shutdown(ctx)
		if err != nil {
			s.logger.Error("Failed to shutdown sdk http server gracefully", zap.Error(err))
		} else {
			s.sdkHttpServer = nil
		}
	}
}

// HttpAgent has the listener that receives the logs and the logger that handles the received logs
type HttpAgent struct {
	listener *LogsApiHttpListener
}

// NewHttpAgent returns an agent to listen and handle logs coming from Logs API for HTTP
// Make sure the agent is initialized by calling Init(agentId) before subscription for the Logs API.
func NewHttpAgent(jq *queue.Queue, logger *zap.Logger) (*HttpAgent, error) {

	logsApiListener, err := NewLogsApiHttpListener(jq, logger)
	if err != nil {
		return nil, err
	}

	return &HttpAgent{
		listener: logsApiListener,
	}, nil
}

// Init initializes the configuration for the Logs API and subscribes to the Logs API for HTTP
func (a HttpAgent) Init(agentID string) error {
	extensions_api_address, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
	if !ok {
		return errors.New("AWS_LAMBDA_RUNTIME_API is not set")
	}

	logsApiBaseUrl := fmt.Sprintf("http://%s", extensions_api_address)

	logsApiClient, err := logsapi.NewClient(logsApiBaseUrl)
	if err != nil {
		return err
	}

	_, err = a.listener.Start()
	if err != nil {
		return err
	}

	eventTypes := []logsapi.EventType{logsapi.Platform, logsapi.Function}
	bufferingCfg := logsapi.BufferingCfg{
		MaxItems:  1000,
		MaxBytes:  262144,
		TimeoutMS: 25,
	}
	if err != nil {
		return err
	}
	env_aws_local, ok := os.LookupEnv("SLS_TEST_EXTENSION")
	URI := fmt.Sprintf("http://sandbox:%s", DefaultHttpListenerPort)
	if ok && env_aws_local == "1" {
		URI = "http://127.0.0.1:" + DefaultHttpListenerPort
	}
	destination := logsapi.Destination{
		Protocol:   logsapi.HttpProto,
		URI:        logsapi.URI(URI),
		HttpMethod: logsapi.HttpPost,
		Encoding:   logsapi.JSON,
	}

	_, err = logsApiClient.Subscribe(eventTypes, bufferingCfg, destination, agentID)
	return err
}

// Shutdown finalizes the logging and terminates the listener
func (a *HttpAgent) Shutdown() {
	a.listener.Shutdown()
}
