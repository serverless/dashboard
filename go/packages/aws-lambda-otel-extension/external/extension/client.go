package extension

import (
	"aws-lambda-otel-extension/external/lib"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"go.uber.org/zap"
)

// AWS /event/next event
type Tracing struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}
type NextEventResponse struct {
	EventType          EventType `json:"eventType"`
	DeadlineMs         int64     `json:"deadlineMs"`
	RequestID          string    `json:"requestId"`
	InvokedFunctionArn string    `json:"invokedFunctionArn"`
	Tracing            Tracing   `json:"tracing"`
}

// EventType is the event type from /event/next event
type EventType string

const (
	Invoke        EventType = "INVOKE"
	Shutdown      EventType = "SHUTDOWN"
	ExtensionName           = "otel-extension"
	// Headers
	extensionNameHeader      = "Lambda-Extension-Name"
	extensionIdentiferHeader = "Lambda-Extension-Identifier"
	extensionErrorType       = "Lambda-Extension-Function-Error-Type"
)

// Client is a simple client for the Lambda Extensions API
type Client struct {
	baseURL     string
	httpClient  *http.Client
	ExtensionID string
	logger      *lib.Logger
}

// NewClient returns a Lambda Extensions API client
func NewClient(awsLambdaRuntimeAPI string) *Client {
	baseURL := fmt.Sprintf("http://%s/2020-01-01/extension", awsLambdaRuntimeAPI)
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{},
		logger:     lib.NewLogger(),
	}
}

// Register will register the extension with the Extensions API
func (e *Client) Register(ctx context.Context) error {
	url := e.baseURL + "/register"

	reqBody, err := json.Marshal(map[string]interface{}{
		"events": []EventType{Invoke, Shutdown},
	})
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return err
	}
	httpReq.Header.Set(extensionNameHeader, ExtensionName)
	httpRes, err := e.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	if httpRes.StatusCode != 200 {
		defer httpRes.Body.Close()
		body, _ := ioutil.ReadAll(httpRes.Body)
		e.logger.Error("Error details", zap.String("body", lib.PrettyPrint(body)))
		return fmt.Errorf("request failed with status %s", httpRes.Status)
	}
	defer httpRes.Body.Close()
	e.ExtensionID = httpRes.Header.Get(extensionIdentiferHeader)

	e.logger.Debug("Registered extension", zap.String("extensionID", e.ExtensionID))

	return nil
}

// NextEvent blocks while long polling for the next lambda invoke or shutdown
func (e *Client) NextEvent(ctx context.Context) (*NextEventResponse, error) {
	url := e.baseURL + "/event/next"

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set(extensionIdentiferHeader, e.ExtensionID)
	httpRes, err := e.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	if httpRes.StatusCode != 200 {
		return nil, fmt.Errorf("request failed with status %s", httpRes.Status)
	}
	defer httpRes.Body.Close()
	body, err := ioutil.ReadAll(httpRes.Body)
	if err != nil {
		return nil, err
	}
	res := NextEventResponse{}
	err = json.Unmarshal(body, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}
