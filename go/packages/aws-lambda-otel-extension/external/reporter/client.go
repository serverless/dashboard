package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"fmt"
	"sync"
	"time"

	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

type PostData struct {
	body       []byte
	path       string
	isProtobuf bool
	retries    int
	name       string
}

type ReporterClient struct {
	ReporterClient *fasthttp.Client
	settings       *lib.ExtensionSettings
	eg             *errgroup.Group
	continueEvents chan bool
	pool           *sync.Pool
	token          string
	logger         *lib.Logger
	clock          time.Time
}

type transformDataType func() ([]byte, error)

func NewReporterClient(settings *lib.ExtensionSettings) *ReporterClient {
	logger := lib.NewLogger()

	token := settings.IngestToken

	return &ReporterClient{
		ReporterClient: &fasthttp.Client{},
		token:          token,
		settings:       settings,
		eg:             &errgroup.Group{},
		continueEvents: make(chan bool),
		logger:         logger,
		pool:           &sync.Pool{},
		clock:          time.Time{},
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

func (c *ReporterClient) post(path string, body []byte, name string, isProtobuf bool) error {
	data := PostData{
		body:       body,
		path:       path,
		isProtobuf: isProtobuf,
		retries:    0,
		name:       name,
	}
	if path == "" {
		return c.syncPostLog(&data)
	}
	return c.syncPost(&data)
}

func (c *ReporterClient) postProto(use lib.ExtensionSettingsEndpoint, protod protoreflect.ProtoMessage, name string) {
	var isProtobuf bool
	var data []byte
	var err error
	if use.ForceJson {
		data, err = (protojson.MarshalOptions{}).Marshal(protod)
		isProtobuf = false
	} else {
		data, err = proto.Marshal(protod)
		isProtobuf = true
	}

	if err != nil {
		c.logger.Error("Error marshalling", zap.Error(err), zap.String("endpoint", use.Destination))
	}

	c.eg.Go(func() error {
		return c.post(use.Destination, data, name, isProtobuf)
	})
}

func (c *ReporterClient) syncPostLog(postData *PostData) (err error) {
	fmt.Printf("⚡ %s: %s\n", postData.name, postData.body)
	// start := time.Now()
	// c.logger.Info("DATA", zap.ByteString("data", postData.body))
	// c.logger.Debug("Post sent", zap.String("path", postData.path), zap.Duration("time", time.Now().Sub(start)))
	return nil
}

func (c *ReporterClient) syncPost(postData *PostData) (err error) {
	start := time.Now()
	code := 0
	defer func() {
		if err != nil {
			c.logger.Error("Post error", zap.String("path", postData.path), zap.Error(err))
			// retry if this isn't intentional error
			if (code < 400 || code > 404) && postData.retries < 3 {
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

	if c.token != "" {
		req.Header.Set("serverless_token", c.token)
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
		return c.post(c.settings.Logs.Destination, logs, "logs", false)
	})
}

func (c *ReporterClient) PostMetrics(metrics *metricspb.MetricsData) {
	c.postProto(c.settings.Metrics, metrics, "metrics")
}

func (c *ReporterClient) PostTrace(trace *tracepb.TracesData) {
	c.postProto(c.settings.Traces, trace, "traces")
}

func (c *ReporterClient) PostRequest(request []byte) {
	c.eg.Go(func() error {
		return c.post(c.settings.Request.Destination, request, "request", false)
	})
}

func (c *ReporterClient) PostResponse(response []byte) {
	c.eg.Go(func() error {
		return c.post(c.settings.Response.Destination, response, "response", false)
	})
}

func (c *ReporterClient) SetDone() {
	c.clock = time.Now()
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
	c.logger.Debug("Shutting down reporter client")
	err := c.WaitRequests(time.Second * 2)
	c.ReporterClient.CloseIdleConnections()
	c.logger.Debug("Shutdown complete")
	return err
}

// clocks logic
func (c *ReporterClient) RegisterClockStart() {
	c.clock = time.Now()
}

func (c *ReporterClient) ReportInitDuration(t time.Time) {
	lib.ErrLogger.Printf("Extension overhead duration: external initialization: %dms\n", time.Now().Sub(t).Milliseconds())
}

func (c *ReporterClient) ReportOverheadDuration() {
	lib.ErrLogger.Printf("Extension overhead duration: external invocation: %dms\n", time.Now().Sub(c.clock).Milliseconds())
}

func (c *ReporterClient) ReportShutdownDuration() {
	lib.ErrLogger.Printf("Extension overhead duration: external shutdown: %dms\n", time.Now().Sub(c.clock).Milliseconds())
}
