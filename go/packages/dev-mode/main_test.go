package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"

	"serverless/dev-mode-extension/agent"
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
	Register  RegisterPayload    `json:"register"`
	RequestId string             `json:"requestId"`
	Logs      []agent.APIPayload `json:"logs"`
	NextCount int64              `json:"nextCount"`
}

var port = 9001
var region = "us-east-1"
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
			if event.Message != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Message, messages[index])
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

	messages2 := []string{"3 invocation", "4 invocation"}
	postLogs(fmt.Sprintf(`[
		{
			"type": "function",
			"record": "%s"
		},
		{
			"type": "function",
			"record": "%s"
		}
	]`, messages2[0], messages2[1]))

	time.Sleep(3 * time.Second)
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
			if event.Message != messages2[index] {
				t.Errorf("Expected log message %s Received %s", event.Message, messages2[index])
			}
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
			if event.Message != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Message, messages[index])
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
			if event.Message != messages[index] {
				t.Errorf("Expected log message %s Received %s", event.Message, messages[index])
			}
		}
	}

	// Ensure we receive the final next event after runtime done
	validationData = getValidations(false)
	if validationData.NextCount < 2 {
		t.Errorf("Expected NextCount %d Received %d", 2, validationData.NextCount)
	}

	// Reset  validations
	resetValidations()
	// End execution
	extensionShutdown(requestId)
	wg.Wait()
}
