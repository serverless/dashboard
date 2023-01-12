package agent

import (
	"bytes"
	"encoding/base64"
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

type LogMessage struct {
	Message    string `json:"message"`
	Timestamp  int64  `json:"timestamp"`
	SequenceId string `json:"sequenceId"`
	AccountId  string `json:"accountId"`
	RequestId  string `json:"requestId"`
}

type LogItem struct {
	Time     string      `json:"time"`
	LogType  string      `json:"type"`
	Metadata interface{} `json:"meta"`
	Record   interface{} `json:"record"`
}

type MetricsObject struct {
	DurationMs    uint32 `json:"durationMs"`
	ProducedBytes uint32 `json:"producedBytes"`
}

type InitReportRecord struct {
	InitializationType string        `json:"initializationType"`
	Metrics            MetricsObject `json:"metrics"`
	Phase              string        `json:"phase"`
}

type TelemetrySpans struct {
	Name       string `json:"name"`
	DurationMs uint32 `json:"durationMs"`
}

type RuntimeDoneRecord struct {
	RequestId string           `json:"requestId"`
	Status    string           `json:"status"`
	Spans     []TelemetrySpans `json:"spans"`
	Metrics   MetricsObject    `json:"metrics"`
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

func FindTraceId(logs []LogItem) string {
	var traceId string = ""
	for _, log := range logs {
		if log.LogType == "spans" {
			rawPayload, _ := base64.StdEncoding.DecodeString(log.Record.(string))
			var devModePayload schema.TracePayload
			traceErr := proto.Unmarshal(rawPayload, &devModePayload)
			if traceErr == nil && devModePayload.Spans[0] != nil {
				traceId = base64.StdEncoding.EncodeToString(devModePayload.Spans[0].TraceId)
				break
			}
		}
	}
	return traceId
}

func FindInitReport(logs []LogItem) *LogItem {
	for _, log := range logs {
		if log.LogType == "platform.initReport" {
			return &log
		}
	}
	return nil
}

func FindPlatformStart(logs []LogItem) *LogItem {
	for _, log := range logs {
		if log.LogType == "platform.start" {
			return &log
		}
	}
	return nil
}

func FindRuntimeDone(logs []LogItem) *LogItem {
	for _, log := range logs {
		if log.LogType == "platform.runtimeDone" {
			return &log
		}
	}
	return nil
}

func FindResData(logs []LogItem) *LogItem {
	for _, log := range logs {
		if log.LogType == "reqRes" {
			rawPayload, _ := base64.StdEncoding.DecodeString(log.Record.(string))
			var reqResPayload schema.RequestResponse
			reqResErr := proto.Unmarshal(rawPayload, &reqResPayload)
			if reqResErr == nil {
				origin := reqResPayload.GetOrigin().String()
				if origin == "ORIGIN_RESPONSE" {
					return &log
				}
			}
		}
	}
	return nil
}

func FindReqData(logs []LogItem) *LogItem {
	for _, log := range logs {
		if log.LogType == "reqRes" {
			rawPayload, _ := base64.StdEncoding.DecodeString(log.Record.(string))
			var reqResPayload schema.RequestResponse
			reqResErr := proto.Unmarshal(rawPayload, &reqResPayload)
			if reqResErr == nil {
				origin := reqResPayload.GetOrigin().String()
				if origin == "ORIGIN_REQUEST" {
					return &log
				}
			}
		}
	}
	return nil
}

func FormatLogs(logs []LogItem, requestId string, accountId string, traceId string) schema.LogPayload {
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
	for i, log := range logs {
		if log.LogType == "function" {
			t, _ := time.Parse(time.RFC3339, log.Time)
			if !strings.Contains(log.Record.(string), "SERVERLESS_TELEMETRY.") {
				// Apparently these environment variables don't
				// exist in the extension 🤷‍♂️
				logGroup := os.Getenv("AWS_LAMBDA_LOG_GROUP_NAME")
				logStream := os.Getenv("AWS_LAMBDA_LOG_STREAM_NAME")
				orgId := os.Getenv("SLS_DEV_MODE_ORG_ID")
				rec := log.Record.(string)
				sequenceId := fmt.Sprintf("%v", time.Now().UnixNano()+int64(i))
				messages = append(messages, &schema.LogEvent{
					Body:      rec,
					Timestamp: uint64(t.UnixMilli()),
					// Allow the backend to handle setting
					// the severity levels
					SeverityText:   "Info",
					SeverityNumber: uint64(1),
					TraceId:        &traceId,
					Tags: &tags.Tags{
						Aws: &tags.AwsTags{
							LogGroup:   &logGroup,
							LogStream:  &logStream,
							SequenceId: &sequenceId,
							AccountId:  &accountId,
							RequestId:  &requestId,
						},
						OrgId: &orgId,
					},
				})
			}
		}
	}
	payload.LogEvents = messages
	return payload
}

func CollectRequestResponseData(logs []LogItem, requestId string, accountId string) ([][]byte, []*LogItem) {
	messages := make([][]byte, 0)
	metadata := make([]*LogItem, 0)
	hasPlatformStart := FindPlatformStart(logs)
	hasRuntimeDone := FindRuntimeDone(logs)
	wrapper := os.Getenv("AWS_LAMBDA_EXEC_WRAPPER")
	hasInternalExtension := wrapper == "/opt/sls-sdk-node/exec-wrapper.sh"
	foundReqRes := false
	for _, log := range logs {
		if log.LogType == "reqRes" {
			foundReqRes = true
			jsonString, _ := json.Marshal(log.Metadata)
			meta := LogItem{}
			json.Unmarshal(jsonString, &meta)
			metadata = append(metadata, &meta)
			messages = append(messages, []byte(log.Record.(string)))
		}
	}

	// Generate the req event if the SDK is not enabled and if we receive the platform.start event.
	if !foundReqRes && hasPlatformStart != nil && !hasInternalExtension {
		isHistorical := false
		body := ""
		payloadType := "aws-lambda-request"
		reqTime, _ := time.Parse("2006-01-02T15:04:05.000Z", hasPlatformStart.Time)
		epoch := uint64(reqTime.UnixNano())
		orgId := os.Getenv("SLS_DEV_MODE_ORG_ID")
		region := os.Getenv("AWS_REGION")
		functionName := os.Getenv("AWS_LAMBDA_FUNCTION_NAME")
		slsTagPlatform := "lambda"
		reqProto := &schema.RequestResponse{
			SlsTags: &tags.SlsTags{
				OrgId: orgId,
				Sdk: &tags.SdkTags{
					Name:    "@serverless/external-extension",
					Version: "N/A",
				},
				Platform: &slsTagPlatform,
				Region:   &region,
				Service:  functionName,
			},
			IsHistorical: &isHistorical,
			Body:         &body,
			RequestId:    &requestId,
			SpanId:       []byte(requestId),
			Origin:       schema.RequestResponse_ORIGIN_REQUEST,
			Timestamp:    &epoch,
			Type:         &payloadType,
			TraceId:      []byte(requestId),
			Tags: &tags.Tags{
				Aws: &tags.AwsTags{
					AccountId:    &accountId,
					Region:       &region,
					RequestId:    &requestId,
					ResourceName: &functionName,
				},
				OrgId: &orgId,
				Sdk: &tags.SdkTags{
					Name:    "@serverless/external-extension",
					Version: "N/A",
				},
			},
		}
		reqData, err := proto.Marshal(reqProto)
		if err == nil {
			messages = append(messages, []byte(base64.StdEncoding.EncodeToString(reqData)))
		}
	}
	// Generate the res event - if we receive the runtime done event and have not received the res event
	if !foundReqRes && hasRuntimeDone != nil {
		isHistorical := false
		body := ""
		payloadType := "aws-lambda-response"
		reqTime, _ := time.Parse("2006-01-02T15:04:05.000Z", hasRuntimeDone.Time)
		epoch := uint64(reqTime.UnixNano())
		orgId := os.Getenv("SLS_DEV_MODE_ORG_ID")
		region := os.Getenv("AWS_REGION")
		functionName := os.Getenv("AWS_LAMBDA_FUNCTION_NAME")
		slsTagPlatform := "lambda"
		reqProto := &schema.RequestResponse{
			SlsTags: &tags.SlsTags{
				OrgId: orgId,
				Sdk: &tags.SdkTags{
					Name:    "@serverless/external-extension",
					Version: "N/A",
				},
				Platform: &slsTagPlatform,
				Region:   &region,
				Service:  functionName,
			},
			IsHistorical: &isHistorical,
			Body:         &body,
			RequestId:    &requestId,
			SpanId:       []byte(requestId),
			Origin:       schema.RequestResponse_ORIGIN_RESPONSE,
			Timestamp:    &epoch,
			Type:         &payloadType,
			TraceId:      []byte(requestId),
			Tags: &tags.Tags{
				Aws: &tags.AwsTags{
					AccountId:    &accountId,
					Region:       &region,
					RequestId:    &requestId,
					ResourceName: &functionName,
				},
				OrgId: &orgId,
				Sdk: &tags.SdkTags{
					Name:    "@serverless/external-extension",
					Version: "N/A",
				},
			},
		}
		reqData, err := proto.Marshal(reqProto)
		if err == nil {
			messages = append(messages, []byte(base64.StdEncoding.EncodeToString(reqData)))
		}
	}

	return messages, metadata
}

func CollectTraceData(logs []LogItem) [][]byte {
	messages := make([][]byte, 0)
	for _, log := range logs {
		if log.LogType == "spans" {
			messages = append(messages, []byte(log.Record.(string)))
		}
	}
	return messages
}

func makeAPICall(body []byte, testReporter func(string), path string, contentType string) (int, error) {
	// Send data to backends
	var _, internalLogsOnly = os.LookupEnv("SLS_TEST_EXTENSION_INTERNAL_LOG")
	var _, toLogs = os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	// If we are running integration tests we just want to write the JSON payloads to CW
	if toLogs {
		testReporter(string(body))
		return 200, nil
	} else {
		url := lib.GetBaseUrl() + path
		lib.Info("Publish URL", url)
		// If we are running unit tests we want to publish logs to the local testing server
		if internalLogsOnly {
			extensions_api_address, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
			if !ok {
				lib.Error("AWS_LAMBDA_RUNTIME_API is not set")
			}
			url = fmt.Sprintf("http://%s/save"+path, extensions_api_address)
		}

		token, _ := os.LookupEnv("SLS_DEV_TOKEN")
		client := &http.Client{}
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
		req.Header.Add("Content-Type", contentType)
		req.Header.Add("Authorization", "Bearer "+token)
		req.Header.Add("sls-token-type", "orgToken")
		res, resErr := client.Do(req)
		if resErr != nil {
			lib.Error("API Call failed", res.StatusCode, res.Body, resErr)
		}
		return res.StatusCode, resErr
	}
}

func ForwardLogs(logs []LogItem, requestId string, accountId string, traceId string) (int, error) {
	region := os.Getenv("AWS_REGION")

	// Send reqRes payloads
	payloads, metadata := CollectRequestResponseData(logs, requestId, accountId)
	if len(payloads) != 0 {
		for index, payload := range payloads {
			rawPayload, _ := base64.StdEncoding.DecodeString(string(payload))
			var devModePayload schema.RequestResponse
			reqResErr := proto.Unmarshal(rawPayload, &devModePayload)
			if reqResErr == nil {

				// Attach metadata from the Lambda Telemetry API
				// to the finalPayload
				var telemetry *schema.LambdaTelemetry
				if len(metadata) > index {
					meta := metadata[index]
					// Update the response payload so that it uses the
					// time from the platform.runtimeDone event
					if meta.Time != "" && devModePayload.Origin == schema.RequestResponse_ORIGIN_RESPONSE {
						metaTime, err := time.Parse("2006-01-02T15:04:05.000Z", meta.Time)
						if err == nil {
							epoch := uint64(metaTime.UnixNano())
							devModePayload.Timestamp = &epoch
						}
					}
					if meta.LogType == "platform.initReport" {
						jsonString, _ := json.Marshal(meta.Record)
						reportData := InitReportRecord{}
						json.Unmarshal(jsonString, &reportData)
						telemetry = &schema.LambdaTelemetry{
							InitDurationMs: &reportData.Metrics.DurationMs,
						}
					} else if meta.LogType == "platform.runtimeDone" {
						jsonString, _ := json.Marshal(meta.Record)
						reportData := RuntimeDoneRecord{}
						json.Unmarshal(jsonString, &reportData)
						responseLatency := uint32(0)
						for _, spanPayload := range reportData.Spans {
							if spanPayload.Name == "responseLatency" {
								responseLatency = spanPayload.DurationMs
							}
						}
						telemetry = &schema.LambdaTelemetry{
							RuntimeDurationMs:        &reportData.Metrics.DurationMs,
							RuntimeResponseLatencyMs: &responseLatency,
						}
					}
				}

				finalProtoPayload := schema.DevModePayload{
					RequestId: requestId,
					AccountId: accountId,
					Region:    region,
					Telemetry: telemetry,
					Payload: &schema.DevModePayload_RequestResponse{
						RequestResponse: &devModePayload,
					},
				}

				finalPayload, _ := proto.Marshal(&finalProtoPayload)
				makeAPICall(finalPayload, lib.ReportReqRes, "/forwarder/reqres", "application/x-protobuf")
			} else {
				lib.Info("Proto Error", reqResErr)
			}
		}
	}

	// Send trace payloads
	tracePayloads := CollectTraceData(logs)
	if len(tracePayloads) != 0 {
		for _, payload := range tracePayloads {
			rawPayload, _ := base64.StdEncoding.DecodeString(string(payload))
			var devModePayload schema.TracePayload
			traceErr := proto.Unmarshal(rawPayload, &devModePayload)
			if traceErr == nil {
				finalProtoPayload := schema.DevModePayload{
					RequestId: requestId,
					AccountId: accountId,
					Region:    region,
					Payload: &schema.DevModePayload_Trace{
						Trace: &devModePayload,
					},
				}
				finalPayload, _ := proto.Marshal(&finalProtoPayload)
				makeAPICall(finalPayload, lib.ReportSpans, "/forwarder/spans", "application/x-protobuf")
			}
		}
	}

	logPayload := FormatLogs(logs, requestId, accountId, traceId)
	if len(logPayload.LogEvents) == 0 {
		return 0, nil
	}

	// Convert proto to bytes
	protoBytes, protoErr := proto.Marshal(&logPayload)
	if protoErr != nil {
		lib.Error("Failed to marshal proto", protoErr)
	}

	// Send data to backends
	return makeAPICall(protoBytes, lib.ReportLog, "/forwarder", "application/x-protobuf")
}
