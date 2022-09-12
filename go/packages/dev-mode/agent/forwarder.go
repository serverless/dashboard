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
)

type PlatformStartRecord struct {
	RequestId string `json:"requestId"`
	Version   string `json:"version"`
}

type LogMessage struct {
	Message    string `json:"message"`
	Timestamp  int64  `json:"timestamp"`
	SequenceId string `json:"sequenceId"`
	AccountId  string `json:"accountId"`
	RequestId  string `json:"requestId"`
}

type LogPayload struct {
	RequestId string       `json:"requestId"`
	TraceId   string       `json:"traceId"`
	OrgUid    string       `json:"orgUid"`
	Name      string       `json:"name"`
	Messages  []LogMessage `json:"messages"`
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

func FormatLogs(logs []LogItem, requestId string) LogPayload {
	messages := make([]LogMessage, 0)
	payload := LogPayload{
		RequestId: requestId,
		TraceId:   "",
		OrgUid:    os.Getenv("SLS_DEV_MODE_ORG_ID"),
		Name:      os.Getenv("AWS_LAMBDA_FUNCTION_NAME"),
		Messages:  messages,
	}
	for _, log := range logs {
		if log.LogType == "function" {
			t, _ := time.Parse(time.RFC3339, log.Time)
			if !strings.Contains(log.Record.(string), "SERVERLESS_TELEMETRY.") {
				messages = append(messages, LogMessage{
					Message:    log.Record.(string),
					Timestamp:  t.UnixMilli(),
					SequenceId: "",
					AccountId:  "",
					RequestId:  requestId,
				})
			}
		}
	}
	payload.Messages = messages
	return payload
}

func ForwardLogs(logs []LogItem, requestId string) (int, error) {
	logPayload := FormatLogs(logs, requestId)
	if len(logPayload.Messages) == 0 {
		return 0, nil
	}
	body, err := json.Marshal(logPayload)
	if err != nil {
		return 0, err
	}

	var _, internalLogsOnly = os.LookupEnv("SLS_TEST_EXTENSION_INTERNAL_LOG")
	var _, toLogs = os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	// If we are running integration tests we just want to write the JSON payloads to CW
	if toLogs {
		lib.ReportLog(string(body))
		return 200, nil
	} else {
		url := "https://core.serverless.com/dev-mode/log-socket/publish"
		// If we are running unit tests we want to publish logs to the local testing server
		if internalLogsOnly {
			extensions_api_address, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
			if !ok {
				fmt.Println("AWS_LAMBDA_RUNTIME_API is not set")
			}
			url = fmt.Sprintf("http://%s/logs/save", extensions_api_address)
		}
		var _, isDev = os.LookupEnv("SERVERLESS_PLATFORM_STAGE")
		if isDev {
			url = "https://core.serverless-dev.com/dev-mode/log-socket/publish"
		}
		res, resErr := http.Post(url, "application/json", bytes.NewBuffer(body))
		return res.StatusCode, resErr
	}
}
