package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"serverless/dev-mode-extension/lib"
	"strings"
	"time"

	tags "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	schema "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"google.golang.org/protobuf/proto"
)

type APIPayload struct {
	Payload []byte `json:"payload"`
}

type ReqResAPIPayload struct {
	Payloads   []string `json:"payloads"`
	Timestamps []int64  `json:"timestamps"`
	AccountId  string   `json:"accountId"`
	Region     string   `json:"region"`
}

type LogMessage struct {
	Message    string `json:"message"`
	Timestamp  int64  `json:"timestamp"`
	SequenceId string `json:"sequenceId"`
	AccountId  string `json:"accountId"`
	RequestId  string `json:"requestId"`
}

type LogItem struct {
	Time    string      `json:"time"`
	LogType string      `json:"type"`
	Record  interface{} `json:"record"`
}

func FindRequestId(logs []LogItem) string {
	var requestId string = ""
	for _, log := range logs {
		if log.LogType == "platform.start" {
			record := log.Record.(map[string]interface{})
			requestId = record["requestId"].(string)
			break
		}
	}
	return requestId
}

func FormatLogs(logs []LogItem, requestId string, accountId string) schema.LogPayload {
	messages := make([]*schema.LogEvent, 0)
	platform := "aws"
	region := os.Getenv("AWS_REGION")
	slsTags := tags.SlsTags{
		OrgId:    os.Getenv("SLS_DEV_MODE_ORG_ID"),
		Platform: &platform,
		Region:   &region,
		Service:  os.Getenv("AWS_LAMBDA_FUNCTION_NAME"),
	}
	payload := schema.LogPayload{
		SlsTags:   &slsTags,
		LogEvents: messages,
	}
	for _, log := range logs {
		if log.LogType == "function" {
			t, _ := time.Parse(time.RFC3339, log.Time)
			if !strings.Contains(log.Record.(string), "SERVERLESS_TELEMETRY.") {
				logGroup := os.Getenv("AWS_LAMBDA_LOG_GROUP_NAME")
				logStream := os.Getenv("AWS_LAMBDA_LOG_STREAM_NAME")
				traceId := ""
				messages = append(messages, &schema.LogEvent{
					Message:    log.Record.(string),
					Timestamp:  uint64(t.UnixMilli()),
					SequenceId: "",
					LogGroup:   &logGroup,
					LogStream:  &logStream,
					AccountId:  &accountId,
					RequestId:  &requestId,
					TraceId:    &traceId,
				})
			}
		}
	}
	payload.LogEvents = messages
	return payload
}

func CollectRequestResponseData(logs []LogItem) ([]string, []int64) {
	messages := make([]string, 0)
	timestamps := make([]int64, 0)
	for _, log := range logs {
		if log.LogType == "function" {
			t, _ := time.Parse(time.RFC3339, log.Time)
			if strings.Contains(log.Record.(string), "SERVERLESS_TELEMETRY.R.") {
				splitString := strings.Split(log.Record.(string), ".R.")
				messages = append(messages, strings.TrimSuffix(splitString[len(splitString)-1], "\n"))
				timestamps = append(timestamps, t.UnixMilli())
			}
		}
	}
	return messages, timestamps
}

func makeAPICall(body []byte, testReporter func(string), path string) (int, error) {
	// Send data to backends
	var _, internalLogsOnly = os.LookupEnv("SLS_TEST_EXTENSION_INTERNAL_LOG")
	var _, toLogs = os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	// If we are running integration tests we just want to write the JSON payloads to CW
	if toLogs {
		testReporter(string(body))
		return 200, nil
	} else {
		url := "https://core.serverless.com/api/ingest" + path
		// If we are running unit tests we want to publish logs to the local testing server
		if internalLogsOnly {
			extensions_api_address, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
			if !ok {
				lib.Error("AWS_LAMBDA_RUNTIME_API is not set")
			}
			url = fmt.Sprintf("http://%s/save"+path, extensions_api_address)
		}
		var _, isDev = os.LookupEnv("SERVERLESS_PLATFORM_STAGE")
		if isDev {
			url = "https://core.serverless-dev.com/api/ingest" + path
		}

		token, _ := os.LookupEnv("SLS_DEV_TOKEN")
		client := &http.Client{}
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
		req.Header.Add("Content-Type", "application/json")
		req.Header.Add("Authorization", "Bearer "+token)
		req.Header.Add("sls-token-type", "orgToken")
		res, resErr := client.Do(req)
		if resErr != nil {
			lib.Error("API Call failed", res.StatusCode, res.Body, resErr)
		}
		return res.StatusCode, resErr
	}
}

func ForwardLogs(logs []LogItem, requestId string, accountId string) (int, error) {
	payloads, timestamps := CollectRequestResponseData(logs)
	if len(payloads) != 0 {
		reqResPayload := ReqResAPIPayload{
			Payloads:   payloads,
			Timestamps: timestamps,
			AccountId:  accountId,
			Region:     os.Getenv("AWS_REGION"),
		}
		reqResBody, err := json.Marshal(reqResPayload)
		if err == nil {
			makeAPICall(reqResBody, lib.ReportReqRes, "/forwarder/reqres")
		}
	}

	logPayload := FormatLogs(logs, requestId, accountId)
	if len(logPayload.LogEvents) == 0 {
		return 0, nil
	}

	// Convert proto to bytes
	protoBytes, protoErr := proto.Marshal(&logPayload)
	if protoErr != nil {
		lib.Error("Failed to marshal proto", protoErr)
	}

	// Add proto to json payload
	jsonData := APIPayload{
		Payload: protoBytes,
	}

	// Stringify json
	body, err := json.Marshal(jsonData)
	if err != nil {
		return 0, err
	}

	// Send data to backends
	return makeAPICall(body, lib.ReportLog, "/forwarder")
}
