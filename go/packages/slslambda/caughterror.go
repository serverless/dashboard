package slslambda

import (
	"time"

	tagsv1 "buf.build/gen/go/serverless/sdk-schema/protocolbuffers/go/serverless/instrumentation/tags/v1"
	instrumentationv1 "buf.build/gen/go/serverless/sdk-schema/protocolbuffers/go/serverless/instrumentation/v1"
)

type caughtError struct {
	errorEvent
}

func newCaughtError(err error, timestamp time.Time, options *EventOptions) *caughtError {
	return &caughtError{errorEvent: errorEvent{
		timestamp:    timestamp,
		error:        err,
		eventOptions: options,
	}}
}

func (ce caughtError) ToProto(traceID, spanID []byte) (*instrumentationv1.Event, error) {
	return convertToProtoErrorEvent(ce.errorEvent, traceID, spanID, tagsv1.ErrorTags_ERROR_TYPE_CAUGHT_USER)
}
