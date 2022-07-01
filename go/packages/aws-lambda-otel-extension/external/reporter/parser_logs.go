package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
)

const ()

// LogMessageTimeLayout is the layout string used to format timestamps from logs
const LogMessageTimeLayout = "2006-01-02T15:04:05.999Z"

// LogMessage is a log message sent by the AWS API.
type LogMessage struct {
	Time    time.Time
	LogType string
	// stringRecord is a string representation of the message's contents. It can be either received directly
	// from the logs API or added by the extension after receiving it.
	StringRecord string
	// object record is the platform log object record
	ObjectRecord types.PlatformObjectRecord
}

// UnmarshalJSON unmarshals the given bytes in a custom LogMessage object.
func (l *LogMessage) UnmarshalJSON(data []byte) error {
	log := lib.NewLogger()

	var j map[string]interface{}
	if err := json.Unmarshal(data, &j); err != nil {
		return fmt.Errorf("LogMessage.UnmarshalJSON: can't unmarshal json: %s", err)
	}

	var typ string
	var ok bool

	// type

	if typ, ok = j["type"].(string); !ok {
		return fmt.Errorf("LogMessage.UnmarshalJSON: malformed log message")
	}

	// time

	if timeStr, ok := j["time"].(string); ok {
		if time, err := time.Parse(LogMessageTimeLayout, timeStr); err == nil {
			l.Time = time
		}
	}

	// the rest

	switch typ {
	case types.LogTypePlatformLogsSubscription, types.LogTypePlatformExtension:
		l.LogType = typ
	case types.LogTypeFunction, types.LogTypeExtension:
		l.LogType = typ
		l.StringRecord = j["record"].(string)
	case types.LogTypePlatformStart, types.LogTypePlatformEnd, types.LogTypePlatformReport, types.LogTypePlatformRuntimeDone:
		l.LogType = typ
		if objectRecord, ok := j["record"].(map[string]interface{}); ok {
			// all of these have the requestId
			if requestID, ok := objectRecord["requestId"].(string); ok {
				l.ObjectRecord.RequestID = requestID
			}

			switch typ {
			case types.LogTypePlatformStart:
				if version, ok := objectRecord["version"].(string); ok {
					l.ObjectRecord.StartLogItem.Version = version
				}
				l.StringRecord = fmt.Sprintf("START RequestId: %s Version: %s",
					l.ObjectRecord.RequestID,
					l.ObjectRecord.StartLogItem.Version,
				)
			case types.LogTypePlatformEnd:
				l.StringRecord = fmt.Sprintf("END RequestId: %s",
					l.ObjectRecord.RequestID,
				)
			case types.LogTypePlatformReport:
				if metrics, ok := objectRecord["metrics"].(map[string]interface{}); ok {
					if v, ok := metrics["durationMs"].(float64); ok {
						l.ObjectRecord.ReportLogItem.DurationMs = v
					}
					if v, ok := metrics["billedDurationMs"].(float64); ok {
						l.ObjectRecord.ReportLogItem.BilledDurationMs = int(v)
					}
					if v, ok := metrics["memorySizeMB"].(float64); ok {
						l.ObjectRecord.ReportLogItem.MemorySizeMB = int(v)
					}
					if v, ok := metrics["maxMemoryUsedMB"].(float64); ok {
						l.ObjectRecord.ReportLogItem.MaxMemoryUsedMB = int(v)
					}
					if v, ok := metrics["initDurationMs"].(float64); ok {
						l.ObjectRecord.ReportLogItem.InitDurationMs = v
					}
					log.Debug(fmt.Sprintf("Enhanced metrics: %+v\n", l.ObjectRecord.ReportLogItem))
				} else {
					log.Error("LogMessage.UnmarshalJSON: can't read the metrics object")
				}
				l.StringRecord = createStringRecordForReportLog(l)
			case types.LogTypePlatformRuntimeDone:
				if status, ok := objectRecord["status"].(string); ok {
					l.ObjectRecord.RuntimeDoneItem = status
				} else {
					log.Debug("Can't read the status from runtimeDone log message")
				}
			}
		} else {
			log.Error("LogMessage.UnmarshalJSON: can't read the record object")
		}
	default:
		log.Debug("Unknown message", zap.String("type", typ))
	}

	return nil
}

func createStringRecordForReportLog(l *LogMessage) string {
	stringRecord := fmt.Sprintf("REPORT RequestId: %s\tDuration: %.2f ms\tBilled Duration: %d ms\tMemory Size: %d MB\tMax Memory Used: %d MB",
		l.ObjectRecord.RequestID,
		l.ObjectRecord.ReportLogItem.DurationMs,
		l.ObjectRecord.ReportLogItem.BilledDurationMs,
		l.ObjectRecord.ReportLogItem.MemorySizeMB,
		l.ObjectRecord.ReportLogItem.MaxMemoryUsedMB,
	)
	initDurationMs := l.ObjectRecord.ReportLogItem.InitDurationMs
	if initDurationMs > 0 {
		stringRecord = stringRecord + fmt.Sprintf("\tInit Duration: %.2f ms", initDurationMs)
	}

	return stringRecord
}

func CreateLogPayload(eventType types.LogEventType, subEventType types.SubEventType, data interface{}) (payload []byte, err error) {
	payload, err = json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return payload, nil
}

// removeInvalidTracingItem is a temporary fix to handle malformed JSON tracing object
func removeInvalidTracingItem(data []byte) []byte {
	return []byte(strings.ReplaceAll(string(data), ",\"tracing\":}", ""))
}

// ParseLogsAPIPayload transforms the payload received from the Logs API to an array of LogMessage
func ParseLogsAPIPayload(data []byte) ([]LogMessage, error) {
	log := lib.NewLogger()
	var messages []LogMessage
	if err := json.Unmarshal(data, &messages); err != nil {
		// Temporary fix to handle malformed JSON tracing object : retry with sanitization
		log.Debug("Can't read log message, retry with sanitization")
		sanitizedData := removeInvalidTracingItem(data)
		if err := json.Unmarshal(sanitizedData, &messages); err != nil {
			return nil, errors.New("can't read log message")
		}
		return messages, nil
	}
	return messages, nil
}

func ReadLogs(msgs []LogMessage, eventData *types.EventDataPayload) (logs []types.LogJson, err error) {
	// Get first / unique key from EventData
	var key string
	for k := range eventData.EventData {
		key = k
		break
	}

	fun, ok := eventData.EventData[key].(map[string]interface{})
	if !ok {
		fmt.Printf(">> ReadLogs not MAPPING!: %+v\n", eventData.EventData[key])
		return
	}

	metricsAtt := map[string]interface{}{}
	for _, kv := range createMetricAttributes(fun, nil) {
		if LogsMetricAttributeNames[kv.Key] {
			metricsAtt[kv.Key] = getJsonValue(kv.Value)
		}
	}

	resourcesAtt := map[string]interface{}{}
	for _, kv := range createResourceAttributes(fun) {
		if LogsResourceAttributeNames[kv.Key] {
			resourcesAtt[kv.Key] = getJsonValue(kv.Value)
		}
	}

	// for loop needs to use index since it's all reference, otherwise we get only last obj
	for i := range msgs {
		if msgs[i].LogType != types.LogTypeFunction {
			continue
		}
		var severityText string
		var severityNumber int64
		parts := strings.Split(msgs[i].StringRecord, "\t")
		if len(parts) > 2 {
			severityText = parts[2]
			severityNumber = int64(LogsSeverityNumber[severityText])
		}
		timestamp := msgs[i].Time.UnixMilli()
		orderId := fmt.Sprint(time.Now().UnixNano())
		logs = append(logs, types.LogJson{
			Body:              &msgs[i].StringRecord,
			Attributes:        resourcesAtt,
			Resource:          metricsAtt,
			Timestamp:         &timestamp,
			TraceId:           &eventData.Span.TraceID,
			SpanId:            &eventData.Span.SpanID,
			SeverityNumber:    &severityNumber,
			SeverityText:      &severityText,
			ProcessingOrderId: &orderId,
		})
	}

	return logs, err
}
