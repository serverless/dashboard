package types

import "encoding/json"

type RecordPayload struct {
	RecordType string          `json:"recordType"`
	Record     json.RawMessage `json:"record"`
}

type EventDataPayload struct {
	Span                *Span                  `json:"span"`
	EventData           map[string]interface{} `json:"eventData"`
	RequestEventPayload *json.RawMessage       `json:"requestEventPayload"`
}

type Span struct {
	SpanID  string `json:"spanId"`
	TraceID string `json:"traceId"`
}

/*
eventDataPayload.record.requestEventPayload = {
	traceId: span.spanContext().traceId,
	spanId: span.spanContext().spanId,
	requestData: event,
	executionId: context.awsRequestId,
}
*/
// type RequestEventPayload struct {
// 	TraceID     string          `json:"traceId"`
// 	SpanID      string          `json:"spanId"`
// 	RequestData json.RawMessage `json:"requestData"`
// 	ExecutionID string          `json:"executionId"`
// }
