package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"

	"golang.org/x/sync/errgroup"
)

type HttpClient struct {
	HttpClient *http.Client
	settings   *lib.UserSettings
	eg         *errgroup.Group
}

type transformDataType func() ([]byte, error)

func NewHttpClient(settings *lib.UserSettings) *HttpClient {
	return &HttpClient{
		HttpClient: &http.Client{},
		settings:   settings,
		eg:         &errgroup.Group{},
	}
}

func (c *HttpClient) Post(path string, body []byte) error {
	req, err := http.NewRequest("POST", path, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	extraParams, err := url.ParseQuery(c.settings.Common.Destination.RequestHeaders)
	if err != nil {
		return err
	}

	for key, value := range extraParams {
		req.Header.Set(key, value[0])
	}

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("request failed with status %s", resp.Status)
	}
	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return nil
}

func (c *HttpClient) PostLogs(transformData transformDataType) {
	c.eg.Go(func() error {
		body, err := transformData()
		if err != nil {
			return err
		}
		// fmt.Printf("sending body '%s\n'", body)
		return c.Post(c.settings.Logs.Destination, body)
	})
}

func (c *HttpClient) PostMetric(metrics string) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Metrics.Destination, []byte(metrics))
	})
}

func (c *HttpClient) Shutdown() error {
	c.HttpClient.CloseIdleConnections()
	return c.eg.Wait()
}
