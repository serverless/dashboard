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
	SpanID            string                 `json:"spanId"`
	TraceID           string                 `json:"traceId"`
	TraceState        string                 `json:"traceState"`
	ParentSpanID      string                 `json:"parentSpanId"`
	Name              string                 `json:"name"`
	Kind              string                 `json:"kind"`
	StartTimeUnixNano string                 `json:"startTimeUnixNano"`
	EndTimeUnixNano   string                 `json:"endTimeUnixNano"`
	Attributes        map[string]interface{} `json:"attributes"`
}

type InstrumentationLibrarySpan struct {
	InstrumentationLibrary *struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"instrumentationLibrary"`
	Spans []*Span `json:"spans"`
}

type Traces struct {
	ResourceSpans []struct {
		InstrumentationLibrarySpans []InstrumentationLibrarySpan `json:"instrumentationLibrarySpans"`
	} `json:"resourceSpans"`
}

// type Traces struct {
// 	ResourceSpans []struct {
// 		InstrumentationLibrarySpans []map[string]interface{} `json:"instrumentationLibrarySpans"`
// 	} `json:"resourceSpans"`
// }

type TelemetryDataPayload struct {
	RequestID            string                 `json:"requestId"`
	Span                 *Span                  `json:"span"`
	Function             map[string]interface{} `json:"function"`
	Traces               *Traces                `json:"traces"`
	ResponseEventPayload *json.RawMessage       `json:"responseEventPayload"`
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
