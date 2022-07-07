package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/protoc"
	"encoding/json"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
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

func (c *ReporterClient) post(path string, body []byte, isProtobuf bool) error {
	data := PostData{
		body:       body,
		path:       path,
		isProtobuf: isProtobuf,
		retries:    0,
	}
	return c.syncPost(&data)
}

func (c *ReporterClient) postProto(use lib.UserSettingsEndpoint, protod protoreflect.ProtoMessage) {
	var isProtobuf bool
	var data []byte
	var err error
	if use.OutputType == "json" {
		data, err = json.Marshal(protod)
		isProtobuf = false
	} else {
		data, err = proto.Marshal(protod)
		isProtobuf = true
	}

	if err != nil {
		c.logger.Error("Error marshalling", zap.Error(err), zap.String("endpoint", use.Destination))
	}

	c.eg.Go(func() error {
		return c.post(use.Destination, data, isProtobuf)
	})
}

func (c *ReporterClient) syncPostTest(postData *PostData) (err error) {
	start := time.Now()
	// c.logger.Info("SLS DATA", zap.ByteString("data", postData.body))
	c.logger.Debug("Post sent", zap.String("path", postData.path), zap.Duration("time", time.Now().Sub(start)))
	return nil
}

func (c *ReporterClient) syncPost(postData *PostData) (err error) {
	start := time.Now()
	code := 0
	defer func() {
		if err != nil {
			c.logger.Error("Post error", zap.String("path", postData.path), zap.Error(err))
			// retry if this isn't intentional error
			if (code < 400 || code > 402) && postData.retries < 3 {
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
	code = resp.StatusCode()
	if code != 200 {
		err = fmt.Errorf("request failed with status %d", code)
		return err
	}
	c.logger.Debug("Post sent", zap.String("path", postData.path), zap.Duration("time", time.Now().Sub(start)))
	return err
}

func (c *ReporterClient) PostLogs(logs []byte) {
	c.eg.Go(func() error {
		return c.post(c.settings.Logs.Destination, logs, false)
	})
}

func (c *ReporterClient) PostMetrics(metrics *protoc.MetricsData) {
	c.postProto(c.settings.Metrics, metrics)
}

func (c *ReporterClient) PostTrace(trace *protoc.TracesData) {
	c.postProto(c.settings.Traces, trace)
}

func (c *ReporterClient) PostRequest(request []byte) {
	c.eg.Go(func() error {
		return c.post(c.settings.Request.Destination, request, false)
	})
}

func (c *ReporterClient) PostResponse(response []byte) {
	c.eg.Go(func() error {
		return c.post(c.settings.Response.Destination, response, false)
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
