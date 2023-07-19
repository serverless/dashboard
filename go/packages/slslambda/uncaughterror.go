package slslambda

import (
	"time"

	tagsv1 "buf.build/gen/go/serverless/sdk-schema/protocolbuffers/go/serverless/instrumentation/tags/v1"
	instrumentationv1 "buf.build/gen/go/serverless/sdk-schema/protocolbuffers/go/serverless/instrumentation/v1"
)

type uncaughtError struct {
	errorEvent
}

func newUncaughtError(err error, timestamp time.Time) *uncaughtError {
	return &uncaughtError{errorEvent: errorEvent{
		timestamp: timestamp,
		error:     err,
	}}
}

func (ue uncaughtError) ToProto(traceID, spanID []byte) (*instrumentationv1.Event, error) {
	return convertToProtoErrorEvent(ue.errorEvent, traceID, spanID, tagsv1.ErrorTags_ERROR_TYPE_UNCAUGHT)
}
