package slslambda

import (
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	instrumentationv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"time"
)

type caughtError struct {
	errorEvent
}

func newCaughtError(err error, timestamp time.Time) *caughtError {
	return &caughtError{errorEvent: errorEvent{
		timestamp: timestamp,
		error:     err,
	}}
}

func (ce caughtError) ToProto(traceID, spanID []byte) (*instrumentationv1.Event, error) {
	return convertToProtoErrorEvent(ce.errorEvent, traceID, spanID, tagsv1.ErrorTags_ERROR_TYPE_CAUGHT_USER)
}
