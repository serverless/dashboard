package slslambda

import (
	"time"

	"buf.build/gen/go/serverless/sdk-schema/protocolbuffers/go/serverless/instrumentation/v1"
)

type initializationSpan struct {
	*basicSpan
}

func (is *initializationSpan) Span() *basicSpan {
	return is.basicSpan
}

func newInitializationSpan(start, end time.Time) *initializationSpan {
	return &initializationSpan{&basicSpan{
		name:       initializationSpanName,
		start:      start,
		end:        end,
		customTags: map[string]string{},
	}}
}

func (is *initializationSpan) Close(t ...time.Time) {
	is.basicSpan.Close(t...)
}

func (is *initializationSpan) ToProto(traceID, spanID, parentSpanID []byte, requestID string, tags tags) *instrumentationv1.Span {
	return is.basicSpan.ToProto(traceID, spanID, parentSpanID, requestID, tags)
}
