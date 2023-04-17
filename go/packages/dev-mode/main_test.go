package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	u "serverless/dev-mode-extension/utils"

	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/sts/stsiface"
	"github.com/google/uuid"
	schema "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"google.golang.org/protobuf/proto"
)

type RegisterPayload struct {
	Events []string `json:"events"`
}

type ValidationLogMessage struct {
	Message string `json:"message"`
}

type ValidationResult struct {
	Register  RegisterPayload `json:"register"`
	RequestId string          `json:"requestId"`
	Logs      []u.APIPayload  `json:"logs"`
	ReqRes    []u.APIPayload  `json:"reqRes"`
	Spans     []u.APIPayload  `json:"spans"`
	NextCount int64           `json:"nextCount"`
}

var port = 9001
var region = "us-east-2"
var functionName = "test-function"

type mockSTSClient struct {
	stsiface.STSAPI
}

func (m *mockSTSClient) GetCallerIdentity(*sts.GetCallerIdentityInput) (*sts.GetCallerIdentityOutput, error) {
	// mock response/functionality
	accountId := "account-id"
	return &sts.GetCallerIdentityOutput{
		Account: &accountId,
	}, nil
}

func TestMain(m *testing.M) {
	svr := u.StartServer("test-function", "us-east-1", 9001)
	os.Setenv("AWS_LAMBDA_RUNTIME_API", fmt.Sprintf("127.0.0.1:%d", port))
	os.Setenv("AWS_LAMBDA_FUNCTION_VERSION", "$LATEST")
	os.Setenv("AWS_REGION", region)
	os.Setenv("AWS_LAMBDA_FUNCTION_NAME", functionName)
	os.Setenv("SLS_DEBUG_EXTENSION", "1")
	os.Setenv("SLS_TEST_EXTENSION_INTERNAL_LOG", "1")
	os.Setenv("SLS_TEST_EXTENSION", "1")
	os.Setenv("AWS_LAMBDA_LOG_GROUP_NAME", "logGroup1")
	os.Setenv("AWS_LAMBDA_LOG_STREAM_NAME", "logStream1")

	code := m.Run()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	err := svr.Shutdown(ctx)
	if err != nil {
		fmt.Println(err)
	}
	fmt.Println("Server exiting")
	os.Exit(code)
}

func extensionReady() {
	u.SubmitLogs([]byte(`[{
		"type": "platform.extension",
		"record": {
			"name": "dev-mode-extension",
			"state": "Ready",
			"events": ["INVOKE", "SHUTDOWN"]
		}
	}]`))
}

func extensionInvoke(requestId string) {
	payload := fmt.Sprintf(`{
    "eventType": "INVOKE",
    "requestId": "%s"
	}`, requestId)
	u.SendPost(fmt.Sprintf("http://127.0.0.1:%d/extension/status", port), []byte(payload))
}

func extensionShutdown(requestId string) {
	payload := fmt.Sprintf(`{
    "eventType": "SHUTDOWN",
    "requestId": "%s"
	}`, requestId)
	u.SendPost(fmt.Sprintf("http://127.0.0.1:%d/extension/status", port), []byte(payload))
}

func resetValidations() {
	u.SendPost(fmt.Sprintf("http://127.0.0.1:%d/reset", port), []byte("{}"))
}

func getValidations(waitLogs bool) ValidationResult {
	validationData := ValidationResult{}
	for {
		response, _ := http.Get(fmt.Sprintf("http://127.0.0.1:%d/validations", port))
		jsonData, _ := ioutil.ReadAll(response.Body)
		json.Unmarshal([]byte(jsonData), &validationData)
		if validationData.RequestId == "" || (waitLogs && len(validationData.Logs) == 0) {
			time.Sleep(2 * time.Second)
		} else {
			break
		}
	}
	return validationData
}

func extensionPlatformStart(requestId string) {
	payload := fmt.Sprintf(`[{
    "type": "platform.start",
		"record": {
			"requestId": "%s",
			"version": "$LATEST"
		}
	}]`, requestId)
	u.SubmitLogs([]byte(payload))
}

func extensionPlatformRuntimeDone(requestId string) {
	payload := fmt.Sprintf(`[{
    "type": "platform.runtimeDone",
		"record": {
			"requestId": "%s",
			"status": "success"
		}
	}]`, requestId)
	u.SubmitLogs([]byte(payload))
}

func postLogs(logs string) {
	u.SubmitLogs([]byte(logs))
}

func postReqRes(data string) {
	u.SubmitReqRes([]byte(data))
}

func postTrace(data string) {
	u.SubmitTrace([]byte(data))
}

func TestInvokeStartDoneTwice(t *testing.T) {
	wg := new(sync.WaitGroup)
	wg.Add(1)
	go func() {
		ext := Extension{
			Client: &mockSTSClient{},
		}
		ext.ExternalExtension()
		wg.Done()
	}()

	// First invocation
	requestId := uuid.New().String()
	extensionReady()
	extensionInvoke(requestId)
	extensionPlatformStart(requestId)

	messages := []string{"1 invocation", "2 invocation"}
	postLogs(fmt.Sprintf(`[
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		}
	]`, messages[0], messages[1]))

	validationData := getValidations(false)

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// Validate we have not received any reqres data
	if len(validationData.ReqRes) != 0 {
		t.Errorf("Expected reqRes len to be 0 Received %d", len(validationData.ReqRes))
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		var protoPayload schema.LogPayload
		err := proto.Unmarshal(payload.Payload, &protoPayload)
		if err != nil {
			t.Errorf("Unable to unmarshal log payload")
		}
		if protoPayload.SlsTags.Service != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, protoPayload.SlsTags.Service)
		}
		for index, event := range protoPayload.LogEvents {
			if event.Body != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Body, messages[index])
			}
			if index == 1 {
				event2SeqId, _ := strconv.ParseInt(*event.Tags.Aws.SequenceId, 10, 64)
				event1SeqId, _ := strconv.ParseInt(*protoPayload.LogEvents[index-1].Tags.Aws.SequenceId, 10, 64)
				if event2SeqId < event1SeqId {
					t.Errorf("Expected log message sequenceId to be an increasing value. Event 2 SequenceId %d. Event 1 SequenceId %d", event2SeqId, event1SeqId)
				}
			}
		}
	}

	extensionPlatformRuntimeDone(requestId)

	time.Sleep(1 * time.Second)
	// Ensure we receive the final next event after runtime done
	validationData = getValidations(false)
	if validationData.NextCount < 2 {
		t.Errorf("Expected NextCount %d Received %d", 2, validationData.NextCount)
	}
	// Reset  validations
	resetValidations()

	// Second invocation
	requestId2 := uuid.New().String()
	extensionInvoke(requestId2)
	extensionPlatformStart(requestId2)

	spanData := "spanData"
	postTrace(spanData)

	messages2 := []string{"3 invocation", "4 invocation", "reqResDataIgnored"}
	postLogs(fmt.Sprintf(`[
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		}
	]`, messages2[0], messages2[1], "SERVERLESS_TELEMETRY.R."+messages2[2]))

	time.Sleep(5 * time.Second)
	validationData2 := getValidations(false)

	// Validate we received the request id we thought we would
	if validationData2.RequestId != requestId2 {
		t.Errorf("Expected requestId %s Received %s", requestId2, validationData2.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData2.Logs {
		var protoPayload schema.LogPayload
		err := proto.Unmarshal(payload.Payload, &protoPayload)
		if err != nil {
			t.Errorf("Unable to unmarshal log payload")
		}
		if protoPayload.SlsTags.Service != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, protoPayload.SlsTags.Service)
		}
		for index, event := range protoPayload.LogEvents {
			if event.Body != messages2[index] {
				t.Errorf("Expected log message %s Received %s", messages2[index], event.Body)
			}
		}
	}

	for _, reqResPayload := range validationData2.ReqRes {
		// reqResStr, _ := base64.StdEncoding.DecodeString(string(reqResPayload.Payload))
		var devModePayload schema.DevModePayload
		err := proto.Unmarshal(reqResPayload.Payload, &devModePayload)
		if err != nil || devModePayload.RequestId != requestId2 {
			t.Errorf("Expected reqRes requestId %s Received %s", requestId2, devModePayload.RequestId)
		}
	}

	for _, spansPayload := range validationData2.Spans {
		spanStr, _ := base64.StdEncoding.DecodeString(string(spansPayload.Payload))
		if string(spanStr) != spanData {
			t.Errorf("Expected span message %s Received %s", spanData, spansPayload.Payload)
		}
	}

	// End execution
	extensionPlatformRuntimeDone(requestId2)
	// Reset  validations
	resetValidations()
	extensionShutdown(requestId2)
	wg.Wait()
}

func TestStartInvokeDone(t *testing.T) {
	wg := new(sync.WaitGroup)
	wg.Add(1)
	go func() {
		ext := Extension{
			Client: &mockSTSClient{},
		}
		ext.ExternalExtension()
		wg.Done()
	}()

	// First invocation
	requestId := uuid.New().String()
	extensionReady()
	extensionPlatformStart(requestId)
	extensionInvoke(requestId)

	messages := []string{"1 invocation", "2 invocation", "{\"level\": \"WARN\"}"}
	postLogs(fmt.Sprintf(`[
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		}
	]`, messages[0], messages[1]))

	validationData := getValidations(false)

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		var protoPayload schema.LogPayload
		err := proto.Unmarshal(payload.Payload, &protoPayload)
		if err != nil {
			t.Errorf("Unable to unmarshal log payload")
		}
		if protoPayload.SlsTags.Service != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, protoPayload.SlsTags.Service)
		}
		if len(protoPayload.LogEvents) != 2 {
			t.Errorf("Expected log message count %d Received %d", 2, len(protoPayload.LogEvents))
		}
		for index, event := range protoPayload.LogEvents {
			if event.Body != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Body, messages[index])
			}
		}
	}

	extensionPlatformRuntimeDone(requestId)
	// Ensure we receive the final next event after runtime done
	time.Sleep(1 * time.Second)
	validationData = getValidations(false)
	if validationData.NextCount < 2 {
		t.Errorf("Expected NextCount %d Received %d", 2, validationData.NextCount)
	}
	// Reset  validations
	resetValidations()
	extensionShutdown(requestId)
	wg.Wait()
}

func TestStartDoneInvoke(t *testing.T) {
	wg := new(sync.WaitGroup)
	wg.Add(1)
	go func() {
		ext := Extension{
			Client: &mockSTSClient{},
		}
		ext.ExternalExtension()
		wg.Done()
	}()

	// Second invocation
	requestId := uuid.New().String()
	extensionPlatformStart(requestId)
	extensionPlatformRuntimeDone(requestId)
	extensionInvoke(requestId)

	messages := []string{"1 invocation\n", "2 invocation \n"}
	postLogs(fmt.Sprintf(`[
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		}
	]`, messages[0], messages[1]))

	validationData := getValidations(false)

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		var protoPayload schema.LogPayload
		err := proto.Unmarshal(payload.Payload, &protoPayload)
		if err != nil {
			t.Errorf("Unable to unmarshal log payload")
		}
		if protoPayload.SlsTags.Service != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, protoPayload.SlsTags.Service)
		}
		for index, event := range protoPayload.LogEvents {
			if event.Body != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Body, messages[index])
			}
		}
	}

	// Ensure we receive the final next event after runtime done
	validationData = getValidations(false)
	if validationData.NextCount < 1 {
		t.Errorf("Expected NextCount %d Received %d", 2, validationData.NextCount)
	}

	// Reset  validations
	resetValidations()
	// End execution
	extensionShutdown(requestId)
	wg.Wait()
}

func TestInvokeWithInitError(t *testing.T) {
	wg := new(sync.WaitGroup)
	wg.Add(1)
	go func() {
		ext := Extension{
			Client: &mockSTSClient{},
		}
		ext.ExternalExtension()
		wg.Done()
	}()

	// First invocation
	requestId := uuid.New().String()
	extensionReady()
	extensionInvoke(requestId)
	// extensionPlatformStart(requestId)

	messages := []string{"1 invocation", "2 invocation"}
	postLogs(fmt.Sprintf(`[
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		}
	]`, messages[0], messages[1]))

	time.Sleep(1 * time.Second)
	extensionPlatformRuntimeDone(requestId)
	extensionShutdown(requestId)
	validationData := getValidations(false)

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// // Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		var protoPayload schema.LogPayload
		err := proto.Unmarshal(payload.Payload, &protoPayload)
		if err != nil {
			t.Errorf("Unable to unmarshal log payload")
		}
		if protoPayload.SlsTags.Service != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, protoPayload.SlsTags.Service)
		}
		for index, event := range protoPayload.LogEvents {
			if event.Body != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Body, messages[index])
			}
		}
	}
	wg.Wait()
}
