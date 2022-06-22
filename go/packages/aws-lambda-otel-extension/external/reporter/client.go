package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/logs"
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"go.uber.org/zap"
)

type HttpClient struct {
	HttpClient *http.Client
	logger     *lib.Logger
	settings   *lib.UserSettings
}

func NewHttpClient(settings *lib.UserSettings) *HttpClient {
	return &HttpClient{
		HttpClient: &http.Client{},
		logger:     lib.NewLogger(),
		settings:   settings,
	}
}

func (c *HttpClient) Post(url string, body []byte) ([]byte, error) {
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		c.logger.Error("Failed to create request", zap.Error(err))
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HttpClient.Do(req)
	if err != nil {
		c.logger.Error("Failed to send request", zap.Error(err))
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		c.logger.Error("Failed to send request", zap.String("status", resp.Status))
		return nil, fmt.Errorf("request failed with status %s", resp.Status)
	}
	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		c.logger.Error("Failed to read response", zap.Error(err))
		return nil, err
	}
	return body, nil
}

func (c *HttpClient) PostLog(logs *[]logs.LogJson) {
	body, err := json.Marshal(logs)
	if err != nil {
		c.logger.Error("Failed to marshal logs", zap.Error(err))
		return
	}
	go c.Post(c.settings.Logs.Destination, body)
}

func (c *HttpClient) PostMetric(metrics string) {
	// body, err := json.Marshal(logs)
	// if err != nil {
	// 	c.logger.Error("Failed to marshal logs", zap.Error(err))
	// 	return
	// }
	go c.Post(c.settings.Metrics.Destination, []byte(metrics))
}

func (c *HttpClient) Shutdown() error {
	c.HttpClient.CloseIdleConnections()

	return nil
}
