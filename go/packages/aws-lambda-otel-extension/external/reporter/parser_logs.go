package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	// logTypeExtension is used to represent logs messages emitted by extensions
	logTypeExtension = "extension"

	// logTypeFunction is used to represent logs messages emitted by the function
	logTypeFunction = "function"

	// logTypePlatformStart is used for the log message about the platform starting
	logTypePlatformStart = "platform.start"
	// logTypePlatformEnd is used for the log message about the platform shutting down
	logTypePlatformEnd = "platform.end"
	// logTypePlatformReport is used for the log messages containing a report of the last invocation.
	logTypePlatformReport = "platform.report"
	// logTypePlatformLogsDropped is used when AWS has dropped logs because we were unable to consume them fast enough.
	logTypePlatformLogsDropped = "platform.logsDropped"
	// logTypePlatformLogsSubscription is used for the log messages about Logs API registration
	logTypePlatformLogsSubscription = "platform.logsSubscription"
	// logTypePlatformExtension is used for the log messages about Extension API registration
	logTypePlatformExtension = "platform.extension"
	// logTypePlatformRuntimeDone is received when the runtime (customer's code) has returned (success or error)
	logTypePlatformRuntimeDone = "platform.runtimeDone"
)

// platformObjectRecord contains additional information found in Platform log messages
type platformObjectRecord struct {
	requestID       string           // uuid; present in LogTypePlatform{Start,End,Report}
	startLogItem    startLogItem     // present in LogTypePlatformStart only
	reportLogItem   reportLogMetrics // present in LogTypePlatformReport only
	runtimeDoneItem runtimeDoneItem  // present in LogTypePlatformRuntimeDone only
}

// reportLogMetrics contains metrics found in a LogTypePlatformReport log
type reportLogMetrics struct {
	durationMs       float64
	billedDurationMs int
	memorySizeMB     int
	maxMemoryUsedMB  int
	initDurationMs   float64
}

type runtimeDoneItem struct {
	status string
}

type startLogItem struct {
	version string
}

// logMessageTimeLayout is the layout string used to format timestamps from logs
const logMessageTimeLayout = "2006-01-02T15:04:05.999Z"

// logMessage is a log message sent by the AWS API.
type logMessage struct {
	time    time.Time
	logType string
	// stringRecord is a string representation of the message's contents. It can be either received directly
	// from the logs API or added by the extension after receiving it.
	stringRecord string
	// object record is the platform log object record
	objectRecord platformObjectRecord
}

// UnmarshalJSON unmarshals the given bytes in a custom LogMessage object.
func (l *logMessage) UnmarshalJSON(data []byte) error {
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
		if time, err := time.Parse(logMessageTimeLayout, timeStr); err == nil {
			l.time = time
		}
	}

	// the rest

	switch typ {
	case logTypePlatformLogsSubscription, logTypePlatformExtension:
		l.logType = typ
	case logTypeFunction, logTypeExtension:
		l.logType = typ
		l.stringRecord = j["record"].(string)
	case logTypePlatformStart, logTypePlatformEnd, logTypePlatformReport, logTypePlatformRuntimeDone:
		l.logType = typ
		if objectRecord, ok := j["record"].(map[string]interface{}); ok {
			// all of these have the requestId
			if requestID, ok := objectRecord["requestId"].(string); ok {
				l.objectRecord.requestID = requestID
			}

			switch typ {
			case logTypePlatformStart:
				if version, ok := objectRecord["version"].(string); ok {
					l.objectRecord.startLogItem.version = version
				}
				l.stringRecord = fmt.Sprintf("START RequestId: %s Version: %s",
					l.objectRecord.requestID,
					l.objectRecord.startLogItem.version,
				)
			case logTypePlatformEnd:
				l.stringRecord = fmt.Sprintf("END RequestId: %s",
					l.objectRecord.requestID,
				)
			case logTypePlatformReport:
				if metrics, ok := objectRecord["metrics"].(map[string]interface{}); ok {
					if v, ok := metrics["durationMs"].(float64); ok {
						l.objectRecord.reportLogItem.durationMs = v
					}
					if v, ok := metrics["billedDurationMs"].(float64); ok {
						l.objectRecord.reportLogItem.billedDurationMs = int(v)
					}
					if v, ok := metrics["memorySizeMB"].(float64); ok {
						l.objectRecord.reportLogItem.memorySizeMB = int(v)
					}
					if v, ok := metrics["maxMemoryUsedMB"].(float64); ok {
						l.objectRecord.reportLogItem.maxMemoryUsedMB = int(v)
					}
					if v, ok := metrics["initDurationMs"].(float64); ok {
						l.objectRecord.reportLogItem.initDurationMs = v
					}
					log.Debug(fmt.Sprintf("Enhanced metrics: %+v\n", l.objectRecord.reportLogItem))
				} else {
					log.Error("LogMessage.UnmarshalJSON: can't read the metrics object")
				}
				l.stringRecord = createStringRecordForReportLog(l)
			case logTypePlatformRuntimeDone:
				if status, ok := objectRecord["status"].(string); ok {
					l.objectRecord.runtimeDoneItem.status = status
				} else {
					log.Debug("Can't read the status from runtimeDone log message")
				}
			}
		} else {
			log.Error("LogMessage.UnmarshalJSON: can't read the record object")
		}
	default:
		log.Debug("Unknown message")
	}

	return nil
}

func createStringRecordForReportLog(l *logMessage) string {
	stringRecord := fmt.Sprintf("REPORT RequestId: %s\tDuration: %.2f ms\tBilled Duration: %d ms\tMemory Size: %d MB\tMax Memory Used: %d MB",
		l.objectRecord.requestID,
		l.objectRecord.reportLogItem.durationMs,
		l.objectRecord.reportLogItem.billedDurationMs,
		l.objectRecord.reportLogItem.memorySizeMB,
		l.objectRecord.reportLogItem.maxMemoryUsedMB,
	)
	initDurationMs := l.objectRecord.reportLogItem.initDurationMs
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

// parseLogsAPIPayload transforms the payload received from the Logs API to an array of LogMessage
func parseLogsAPIPayload(data []byte) ([]logMessage, error) {
	log := lib.NewLogger()
	var messages []logMessage
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

func readLogs(data []byte, eventData *types.EventDataPayload) (logs []types.LogJson, err error) {
	msgs, err := parseLogsAPIPayload(data)
	if err != nil {
		return nil, err
	}

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
		if msgs[i].logType != logTypeFunction {
			continue
		}
		var severityText string
		var severityNumber int64
		parts := strings.Split(msgs[i].stringRecord, "\t")
		if len(parts) > 2 {
			severityText = parts[2]
			severityNumber = int64(LogsSeverityNumber[severityText])
		}
		timestamp := msgs[i].time.UnixMilli()
		orderId := fmt.Sprint(time.Now().UnixNano())
		logs = append(logs, types.LogJson{
			Body:              &msgs[i].stringRecord,
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
