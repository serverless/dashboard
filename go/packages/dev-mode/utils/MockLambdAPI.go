package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"serverless/dev-mode-extension/agent"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Validations struct {
	Register  string                   `json:"register"`
	LogTypes  []string                 `json:"logTypes"`
	LogURI    string                   `json:"logURI"`
	SdkURI    string                   `json:"sdkURI"`
	RequestId string                   `json:"requestId"`
	Logs      []agent.APIPayload       `json:"logs"`
	ReqRes    []agent.ReqResAPIPayload `json:"reqRes"`
	Spans     []agent.SpanAPIPayload   `json:"spans"`
	NextCount int64                    `json:"nextCount"`
}

type LogRegisterDestinationInput struct {
	URI string `json:"URI"`
}

type LogRegisterInput struct {
	LogTypes    []string                    `json:"logTypes"`
	Destination LogRegisterDestinationInput `json:"destination"`
}

type SetStatusInput struct {
	EventType string `json:"eventType"`
	RequestId string `json:"requestId"`
}

type TracingResponse struct {
	TraceType string `json:"type"`
	Value     string `json:"value"`
}

type NextResponse struct {
	EventType          string          `json:"eventType"`
	RequestId          string          `json:"requestId"`
	DeadlineMs         int64           `json:"deadlineMS"`
	InvokedFunctionArn string          `json:"invokedFunctionArn"`
	Tracing            TracingResponse `json:"tracing"`
	ShutdownReason     string          `json:"shutdownReason"`
}

var funcName = "test-function"
var reg = "us-east-1"
var status string = ""
var lambdaExtensionIdentifier = uuid.New().String()
var validations = Validations{
	Register:  "",
	LogURI:    "",
	SdkURI:    "http://127.0.0.1:2772",
	RequestId: "",
	Logs:      make([]agent.APIPayload, 0),
	ReqRes:    make([]agent.ReqResAPIPayload, 0),
	Spans:     make([]agent.SpanAPIPayload, 0),
	NextCount: 0,
}

func StartServer(functionName string, region string, port int64) *http.Server {
	funcName = functionName
	reg = region
	// Reset LogURI between test runs only
	validations.LogURI = ""
	validations.SdkURI = "http://127.0.0.1:2772"
	validations.NextCount = 0
	srv := createLambdaServer(port)
	go func() {
		_ = srv.ListenAndServe()
	}()

	return srv
}

func createLambdaServer(port int64) *http.Server {
	router := gin.Default()
	router.POST("/extension/status", setStatus)
	router.POST("/reset", resetValidation)
	router.GET("/validations", savedData)

	router.POST("/2020-01-01/extension/register", registerEndpoint)
	router.GET("/2020-01-01/extension/event/next", nextEndpoint)
	router.PUT("/2020-08-15/logs", registerLogs)
	router.POST("/logs", sendLogs)
	router.POST("/save/forwarder", saveLogs)
	router.POST("/save/forwarder/reqres", saveReqRes)
	router.POST("/save/forwarder/spans", saveSpans)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: router,
	}

	return srv
}

func registerEndpoint(c *gin.Context) {
	jsonData, err := ioutil.ReadAll(c.Request.Body)
	if err != nil {
		return
	}
	validations.Register = string(jsonData)
	c.Header("lambda-extension-identifier", lambdaExtensionIdentifier)
	c.Header("date", "Mon, 14 Feb 2022 15:29:54 GMT")
	c.Header("connection", "close")
	c.Status(200)
	c.IndentedJSON(http.StatusOK, c.Request.Body)
}

func savedData(c *gin.Context) {
	data, _ := json.Marshal(validations)
	println(string(data))
	c.IndentedJSON(http.StatusOK, validations)
}

func setStatus(c *gin.Context) {
	var input SetStatusInput
	if err := c.BindJSON(&input); err != nil {
		return
	}
	status = input.EventType
	validations.RequestId = input.RequestId
	c.JSON(http.StatusOK, input)
}

func nextEndpoint(c *gin.Context) {
	validations.NextCount += 1
	// Wait for status to be invoke or shutdown
	for {
		if status != "" {
			break
		}
	}
	localStatus := status
	status = ""
	var res NextResponse
	res.EventType = localStatus
	res.RequestId = validations.RequestId
	if localStatus == "Invoke" {
		res.DeadlineMs = time.Now().UnixMilli() + 8000
		res.InvokedFunctionArn = fmt.Sprintf("arn:aws:lambda:%s:992311060759:function:%s", reg, funcName)
		res.Tracing = TracingResponse{
			TraceType: "X-Amzn-Trace-Id",
			Value:     "Root=1-62971da1-6dcad18541c031653bce35ac;Parent=6a51e17e405247ac;Sampled=0",
		}
		res.ShutdownReason = ""
	} else {
		res.DeadlineMs = time.Now().UnixMilli() + 3000
		res.ShutdownReason = "spindown"
	}
	c.Header("lambda-extension-event-identifier", lambdaExtensionIdentifier)
	c.Header("date", "Mon, 14 Feb 2022 15:29:54 GMT")
	c.Header("connection", "close")
	c.Status(200)
	c.JSON(http.StatusOK, res)
}

func registerLogs(c *gin.Context) {
	var input LogRegisterInput
	if err := c.BindJSON(&input); err != nil {
		return
	}
	validations.LogURI = input.Destination.URI
	validations.LogTypes = input.LogTypes

	c.Header("lambda-extension-event-identifier", lambdaExtensionIdentifier)
	c.Header("date", "Mon, 14 Feb 2022 15:29:54 GMT")
	c.Header("connection", "close")
	c.Status(200)

	reqChan := make(chan *http.Response)
	subscriptionMessage := fmt.Sprintf(`[{
		"time": "%d",
		"type": "platform.logsSubscription",
		"record": {
			"name": "dev-mode-extension",
			"state": "Subscribed",
			"types": %v
		}
	}]`, time.Now().UnixMilli(), input.LogTypes)
	thing := json.RawMessage(subscriptionMessage)
	go SendPostAsync(validations.LogURI, thing, reqChan)

	// Send http request to self so we can trigger logSubscription log
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("OK"))
}

func saveLogs(c *gin.Context) {
	var input agent.APIPayload
	if err := c.BindJSON(&input); err != nil {
		return
	}
	validations.Logs = append(validations.Logs, input)
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("OK"))
}

func saveReqRes(c *gin.Context) {
	var input agent.ReqResAPIPayload
	if err := c.BindJSON(&input); err != nil {
		return
	}
	fmt.Println("Expected reqres", input.Payloads)
	validations.ReqRes = append(validations.ReqRes, input)
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("OK"))
}

func saveSpans(c *gin.Context) {
	var input agent.SpanAPIPayload
	if err := c.BindJSON(&input); err != nil {
		return
	}
	fmt.Println("Expected span", input.Payloads)
	validations.Spans = append(validations.Spans, input)
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("OK"))
}

func sendLogs(c *gin.Context) {
	// Wait for logs URI
	for {
		if validations.LogURI != "" {
			break
		}
	}
	ByteBody, _ := ioutil.ReadAll(c.Request.Body)
	reqChan := make(chan *http.Response)
	go SendPostAsync(validations.LogURI, ByteBody, reqChan)
}

func SubmitLogs(logs []byte) {
	for {
		if validations.LogURI != "" {
			break
		}
	}
	for {
		_, err := SendPost(validations.LogURI, logs)
		if err == nil {
			break
		} else {
			time.Sleep(1 * time.Second)
		}
	}
}

func SubmitReqRes(data []byte) {
	for {
		if validations.LogURI != "" {
			break
		}
	}
	fmt.Println("Making reqres...", validations.SdkURI+"/reqres")
	for {
		_, err := SendPost(validations.SdkURI+"/reqres", data)
		if err == nil {
			break
		} else {
			fmt.Println(err)
			time.Sleep(1 * time.Second)
		}
	}
	fmt.Println("Done reqres...")
}

func SubmitTrace(data []byte) {
	for {
		if validations.LogURI != "" {
			break
		}
	}
	fmt.Println("Making trace...")
	for {
		_, err := SendPost(validations.SdkURI+"/spans", data)
		if err == nil {
			break
		} else {
			time.Sleep(1 * time.Second)
		}
	}
	fmt.Println("Done trace...")
}

func SubmitLogsAsync(logs []byte) {
	for {
		if validations.LogURI != "" {
			break
		}
	}
	reqChan := make(chan *http.Response)
	SendPostAsync(validations.LogURI, logs, reqChan)
}

func SendPostAsync(url string, body []byte, rc chan *http.Response) {
	response, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		panic(err)
	}
	rc <- response
}

func SendPost(url string, body []byte) (*http.Response, error) {
	res, err := http.Post(url, "application/json", bytes.NewReader(body))
	return res, err
}

func resetValidation(c *gin.Context) {
	validations = Validations{
		Register: "",
		// Don't clear logs URI or else the app wont work between invocations :)
		LogURI:    validations.LogURI,
		SdkURI:    "http://127.0.0.1:2772",
		RequestId: "",
		Logs:      make([]agent.APIPayload, 0),
		ReqRes:    make([]agent.ReqResAPIPayload, 0),
		Spans:     make([]agent.SpanAPIPayload, 0),
		NextCount: 0,
	}
	c.Data(http.StatusOK, "text/html", []byte("ok"))
}
