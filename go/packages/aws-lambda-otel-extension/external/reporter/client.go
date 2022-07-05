package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/protoc"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/proto"
)

type PostData struct {
	body       []byte
	path       string
	isProtobuf bool
	retries    int
}

type ReporterClient struct {
	ReporterClient *fasthttp.Client
	settings       *lib.UserSettings
	eg             *errgroup.Group
	continueEvents chan bool
	pool           *sync.Pool
	extraParams    url.Values
	logger         *lib.Logger
}

type transformDataType func() ([]byte, error)

func NewReporterClient(settings *lib.UserSettings) *ReporterClient {
	logger := lib.NewLogger()

	extraParams, err := url.ParseQuery(settings.Common.Destination.RequestHeaders)
	if err != nil {
		logger.Error("Parsing request headers", zap.Error(err))
	}

	return &ReporterClient{
		ReporterClient: &fasthttp.Client{},
		settings:       settings,
		eg:             &errgroup.Group{},
		extraParams:    extraParams,
		continueEvents: make(chan bool),
		logger:         logger,
		pool:           &sync.Pool{},
	}
}

func (c *ReporterClient) Flush() {
	for {
		if postData := c.pool.Get(); postData != nil {
			data := postData.(PostData)
			c.eg.Go(func() error {
				return c.syncPost(&data)
			})
		} else {
			return
		}
	}
}

func (c *ReporterClient) Post(path string, body []byte, isProtobuf bool) error {
	data := PostData{
		body:       body,
		path:       path,
		isProtobuf: isProtobuf,
		retries:    0,
	}
	return c.syncPost(&data)
}

func (c *ReporterClient) syncPost(postData *PostData) (err error) {
	start := time.Now()
	defer func() {
		if err != nil {
			c.logger.Error("Post error", zap.String("path", postData.path))
			if postData.retries < 3 {
				postData.retries++
				c.pool.Put(*postData)
			} // otherwise just stop trying to send this data...
		}
	}()
	// c.logger.Debug("Sending post", zap.String("path", postData.path))

	req := fasthttp.AcquireRequest()
	defer fasthttp.ReleaseRequest(req)
	req.Header.SetMethod("POST")
	req.SetRequestURI(postData.path)
	req.SetBody(postData.body)

	req.Header.Set("accept-encoding", "gzip")
	if postData.isProtobuf {
		req.Header.SetContentType("application/x-protobuf")
	} else {
		req.Header.SetContentType("application/json")
	}

	for key, value := range c.extraParams {
		req.Header.Set(key, value[0])
	}

	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseResponse(resp)

	err = c.ReporterClient.Do(req, resp)
	if err != nil {
		return err
	}
	if resp.StatusCode() != 200 {
		err = fmt.Errorf("request failed with status %d", resp.StatusCode())
		return err
	}
	c.logger.Debug("Post sent", zap.String("path", postData.path), zap.Duration("time", time.Now().Sub(start)))
	return err
}

func (c *ReporterClient) PostLogs(logs []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Logs.Destination, logs, false)
	})
}

func (c *ReporterClient) PostMetrics(metrics *protoc.MetricsData) {
	data, err := proto.Marshal(metrics)
	// data, err := json.Marshal(metrics)
	if err != nil {
		c.logger.Error("Error marshalling metrics", zap.Error(err))
	}

	c.eg.Go(func() error {
		return c.Post(c.settings.Metrics.Destination, data, true)
	})
}

func (c *ReporterClient) PostTrace(trace *protoc.TracesData) {
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

func (c *ReporterClient) PostRequest(request []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Request.Destination, request, false)
	})
}

func (c *ReporterClient) PostResponse(response []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Response.Destination, response, false)
	})
}

func (c *ReporterClient) SetDone() {
	c.continueEvents <- true
}

func (c *ReporterClient) WaitDone() {
	<-c.continueEvents
}

func (c *ReporterClient) WaitRequests(waitTime time.Duration) error {
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

func (c *ReporterClient) Shutdown() error {
	err := c.WaitRequests(time.Second * 2)
	c.ReporterClient.CloseIdleConnections()
	return err
}
