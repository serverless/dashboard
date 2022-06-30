package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
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
}

type transformDataType func() ([]byte, error)

func NewHttpClient(settings *lib.UserSettings) *HttpClient {

	extraParams, err := url.ParseQuery(settings.Common.Destination.RequestHeaders)
	if err != nil {
		fmt.Printf(">> error parsing request headers: %s\n", err)
	}

	return &HttpClient{
		HttpClient:     &http.Client{},
		settings:       settings,
		eg:             &errgroup.Group{},
		stackLock:      &sync.Mutex{},
		extraParams:    extraParams,
		continueEvents: make(chan bool),
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
	defer c.Flush()
	defer c.stackLock.Unlock()
	data := PostData{
		body:       body,
		path:       path,
		lock:       &sync.Mutex{},
		trying:     false,
		prev:       c.stackLast,
		isProtobuf: isProtobuf,
	}
	c.stackLast = &data
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
		c.removeStack(postData)
		if err != nil {
			fmt.Printf(">> error for '%s' - %s\n", postData.path, err)
		}
	}()
	fmt.Printf(">> sending post '%s'\n", postData.path)
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
	// _, err = ioutil.ReadAll(resp.Body)
	// if err != nil {
	// 	return err
	// }
	fmt.Printf(">> post sent '%s' (%s)\n", postData.path, time.Now().Sub(start))
	return nil
}

func (c *HttpClient) PostLogs(logs []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Logs.Destination, logs, false)
	})
}

func (c *HttpClient) PostMetric(metrics []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Metrics.Destination, metrics, true)
	})
}

func (c *HttpClient) PostTrace(trace []byte) {
	c.eg.Go(func() error {
		return c.Post(c.settings.Traces.Destination, trace, true)
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

func (c *HttpClient) WaitRequests() error {
	c.Flush()
	err := c.eg.Wait()
	return err
}

func (c *HttpClient) Shutdown() error {
	err := c.WaitRequests()
	c.HttpClient.CloseIdleConnections()
	return err
}
