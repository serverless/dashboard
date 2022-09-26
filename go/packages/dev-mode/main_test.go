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

	u "serverless/dev-mode-extension/utils"

	"github.com/google/uuid"
)

type RegisterPayload struct {
	Events []string `json:"events"`
}

type ValidationLogMessage struct {
	Message string `json:"message"`
}

type ValidationLogPayload struct {
	RequestId string                 `json:"requestId"`
	TraceId   string                 `json:"traceId"`
	OrgUid    string                 `json:"orgUid"`
	Name      string                 `json:"name"`
	Messages  []ValidationLogMessage `json:"message"`
}

type ValidationResult struct {
	Register  RegisterPayload        `json:"register"`
	RequestId string                 `json:"requestId"`
	Logs      []ValidationLogPayload `json:"logs"`
	NextCount int64                  `json:"nextCount"`
}

var port = 9001
var region = "us-east-1"
var functionName = "test-function"

func TestMain(m *testing.M) {
	svr := u.StartServer("test-function", "us-east-1", 9001)
	os.Setenv("AWS_LAMBDA_RUNTIME_API", fmt.Sprintf("127.0.0.1:%d", port))
	os.Setenv("AWS_LAMBDA_FUNCTION_VERSION", "$LATEST")
	os.Setenv("AWS_REGION", region)
	os.Setenv("AWS_LAMBDA_FUNCTION_NAME", functionName)
	os.Setenv("SLS_DEBUG_EXTENSION", "1")
	os.Setenv("SLS_TEST_EXTENSION_INTERNAL_LOG", "1")
	os.Setenv("SLS_TEST_EXTENSION", "1")

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

func getValidations() ValidationResult {
	validationData := ValidationResult{}
	for {
		response, _ := http.Get(fmt.Sprintf("http://127.0.0.1:%d/validations", port))
		jsonData, _ := ioutil.ReadAll(response.Body)
		json.Unmarshal([]byte(jsonData), &validationData)
		if validationData.RequestId == "" {
			time.Sleep(2 * time.Second)
		} else {
			break
		}
	}
	return validationData
}

func extensionPlatformStart(requestId string) {
	payload := fmt.Sprintf(`{
    "type": "platform.start",
		"record": {
			"requestId": "%s",
			"version": "$LATEST"
		}
	}`, requestId)
	u.SubmitLogs([]byte(payload))
}

func extensionPlatformRuntimeDone(requestId string) {
	payload := fmt.Sprintf(`{
    "type": "platform.runtimeDone",
		"record": {
			"requestId": "%s",
			"status": "success"
		}
	}`, requestId)
	u.SubmitLogs([]byte(payload))
}

func postLogs(logs string) {
	u.SubmitLogs([]byte(logs))
}

func TestInvokeStartDoneTwice(t *testing.T) {
	wg := new(sync.WaitGroup)
	wg.Add(1)
	go func() {
		ExternalExtension()
		wg.Done()
	}()

	// First invocation
	requestId := uuid.New().String()
	extensionReady()
	extensionInvoke(requestId)
	extensionPlatformStart(requestId)

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

	validationData := getValidations()

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		if payload.Name != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, payload.Name)
			for index, message := range payload.Messages {
				if message.Message != messages[index] {
					t.Errorf("Expected log message %s Received %s", message.Message, messages[index])
				}
			}
		}
	}

	extensionPlatformRuntimeDone(requestId)

	// Ensure we receive the final next event after runtime done
	validationData = getValidations()
	if validationData.NextCount < 2 {
		t.Errorf("Expected NextCount %d Received %d", 2, validationData.NextCount)
	}
	// Reset  validations
	resetValidations()

	// Second invocation
	requestId2 := uuid.New().String()
	extensionInvoke(requestId2)
	extensionPlatformStart(requestId2)

	messages2 := []string{"3 invocation\n", "4 invocation \n"}
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

	validationData2 := getValidations()

	// Validate we received the request id we thought we would
	if validationData2.RequestId != requestId2 {
		t.Errorf("Expected requestId %s Received %s", requestId2, validationData2.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData2.Logs {
		if payload.Name != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, payload.Name)
			for index, message := range payload.Messages {
				if message.Message != messages[index] {
					t.Errorf("Expected log message %s Received %s", message.Message, messages2[index])
				}
			}
		}
	}

	// End execution
	extensionPlatformRuntimeDone(requestId2)
	extensionShutdown(requestId2)
	wg.Wait()
}

func TestStartInvokeDone(t *testing.T) {
	wg := new(sync.WaitGroup)
	wg.Add(1)
	go func() {
		ExternalExtension()
		wg.Done()
	}()

	// First invocation
	requestId := uuid.New().String()
	extensionReady()
	extensionPlatformStart(requestId)
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

	validationData := getValidations()

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		if payload.Name != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, payload.Name)
			for index, message := range payload.Messages {
				if message.Message != messages[index] {
					t.Errorf("Expected log message %s Received %s", message.Message, messages[index])
				}
			}
		}
	}

	extensionPlatformRuntimeDone(requestId)
	// Ensure we receive the final next event after runtime done
	validationData = getValidations()
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
		ExternalExtension()
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

	validationData := getValidations()

	// Validate we received the request id we thought we would
	if validationData.RequestId != requestId {
		t.Errorf("Expected requestId %s Received %s", requestId, validationData.RequestId)
	}

	// Validate we received the logs we thought we would
	for _, payload := range validationData.Logs {
		if payload.Name != functionName {
			t.Errorf("Expected function name %s Received %s", functionName, payload.Name)
			for index, message := range payload.Messages {
				if message.Message != messages[index] {
					t.Errorf("Expected log message %s Received %s", message.Message, messages[index])
				}
			}
		}
	}

	// Ensure we receive the final next event after runtime done
	validationData = getValidations()
	if validationData.NextCount < 2 {
		t.Errorf("Expected NextCount %d Received %d", 2, validationData.NextCount)
	}

	// End execution
	extensionShutdown(requestId)
	wg.Wait()
}
