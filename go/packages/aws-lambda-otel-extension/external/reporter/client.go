package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/protoc"
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/proto"
)

type PostData struct {
	body       []byte
	path       string
	isProtobuf bool
	trying     bool
	lock       *sync.Mutex
	next       *PostData
	prev       *PostData
}

type HttpClient struct {
	HttpClient     *http.Client
	settings       *lib.UserSettings
	eg             *errgroup.Group
	continueEvents chan bool
	stackLast      *PostData
	stackLock      *sync.Mutex
	extraParams    url.Values
	logger         *lib.Logger
}

type transformDataType func() ([]byte, error)

func NewHttpClient(settings *lib.UserSettings) *HttpClient {
	logger := lib.NewLogger()

	extraParams, err := url.ParseQuery(settings.Common.Destination.RequestHeaders)
	if err != nil {
		logger.Error("Parsing request headers", zap.Error(err))
	}

	return &HttpClient{
		HttpClient:     &http.Client{},
		settings:       settings,
		eg:             &errgroup.Group{},
		stackLock:      &sync.Mutex{},
		extraParams:    extraParams,
		continueEvents: make(chan bool),
		logger:         logger,
	}
}

func (c *HttpClient) Flush() {
	current := c.stackLast
	for {
		if current == nil {
			return
		}
		if !current.trying {
			param := current
			c.eg.Go(func() error {
				return c.syncPost(param)
			})
		}
		current = current.prev
	}
}

func (c *HttpClient) Post(path string, body []byte, isProtobuf bool) error {
	c.stackLock.Lock()
	data := PostData{
		body:       body,
		path:       path,
		lock:       &sync.Mutex{},
		trying:     false,
		prev:       c.stackLast,
		isProtobuf: isProtobuf,
	}
	c.stackLast = &data
	c.stackLock.Unlock()
	c.eg.Go(func() error {
		return c.syncPost(&data)
	})
	return nil
}

func (c *HttpClient) removeStack(postData *PostData) {
	c.stackLock.Lock()
	defer c.stackLock.Unlock()
	if postData.prev == nil {
		c.stackLast = postData.next
	} else {
		postData.prev.next = postData.next
	}
	if postData.next != nil {
		postData.next.prev = postData.prev
	}
}

func (c *HttpClient) syncPost(postData *PostData) (err error) {
	postData.lock.Lock()
	start := time.Now()
	postData.trying = true
	defer func() {
		if err != nil {
			c.logger.Error("Post error", zap.Error(err))
		}
		c.removeStack(postData)
		postData.lock.Unlock()
	}()
	// c.logger.Debug("Sending post", zap.String("path", postData.path))
	req, err := http.NewRequest("POST", postData.path, bytes.NewBuffer(postData.body))
	if err != nil {
		return err
	}

	req.Header.Set("accept-encoding", "gzip")

	if postData.isProtobuf {
		req.Header.Set("Content-Type", "application/x-protobuf")
	} else {
		req.Header.Set("Content-Type", "application/json")
	}

	for key, value := range c.extraParams {
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
	c.logger.Debug("Post sent", zap.String("path", postData.path), zap.Duration("time", time.Now().Sub(start)))
	return nil
}

func (c *HttpClient) PostLogs(logs []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Logs.Destination, logs, false)
	})
}

func (c *HttpClient) PostMetrics(metrics *protoc.MetricsData) {
	data, err := proto.Marshal(metrics)
	// data, err := json.Marshal(metrics)
	if err != nil {
		c.logger.Error("Error marshalling metrics", zap.Error(err))
	}

	c.eg.Go(func() error {
		return c.Post(c.settings.Metrics.Destination, data, true)
	})
}

func (c *HttpClient) PostTrace(trace *protoc.TracesData) {
	data, err := proto.Marshal(trace)
	// data, err := json.Marshal(trace)
	if err != nil {
		c.logger.Error("Error marshalling traces", zap.Error(err))
		return
	}

	c.eg.Go(func() error {
		return c.Post(c.settings.Traces.Destination, data, true)
	})
}

func (c *HttpClient) PostRequest(request []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Request.Destination, request, false)
	})
}

func (c *HttpClient) PostResponse(response []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Response.Destination, response, false)
	})
}

func (c *HttpClient) SetDone() {
	c.continueEvents <- true
}

func (c *HttpClient) WaitDone() {
	<-c.continueEvents
}

func (c *HttpClient) WaitRequests(waitTime time.Duration) error {
	c.Flush()
	done := make(chan struct{})
	var err error
	go func() {
		defer close(done)
		err = c.eg.Wait()
	}()
	select {
	case <-done:
		return err
	// dont wait more than 500ms for requests to finish
	case <-time.After(waitTime):
		return err
	}
}

func (c *HttpClient) Shutdown() error {
	err := c.WaitRequests(time.Second * 2)
	c.HttpClient.CloseIdleConnections()
	return err
}
