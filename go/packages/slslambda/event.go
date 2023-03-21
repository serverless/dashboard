package slslambda

import (
	"fmt"
	"github.com/aws/aws-lambda-go/lambda/messages"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	instrumentationv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
)

const (
	telemetryErrorGeneratedV1   = "telemetry.error.generated.v1"
	telemetryWarningGeneratedV1 = "telemetry.warning.generated.v1"
)

type (
	errorEvent struct {
		timestamp time.Time
		error
	}
	warningEvent struct {
		timestamp time.Time
		message   string
	}
	protoEvent interface {
		ToProto(traceID, parentSpanID []byte) (*instrumentationv1.Event, error)
	}
)

func convertToProtoEvents(errorEvents []protoEvent, warningEvents []warningEvent, traceID, spanID []byte) ([]*instrumentationv1.Event, error) {
	var protoEvents []*instrumentationv1.Event
	for _, event := range errorEvents {
		protoEvent, err := event.ToProto(traceID, spanID)
		if err != nil {
			return nil, fmt.Errorf("convert to proto error event: %w", err)
		}
		protoEvents = append(protoEvents, protoEvent)
	}
	for _, event := range warningEvents {
		protoEvent, err := convertToProtoWarningEvent(event, traceID, spanID)
		if err != nil {
			return nil, fmt.Errorf("convert to proto warning event: %w", err)
		}
		protoEvents = append(protoEvents, protoEvent)
	}
	return protoEvents, nil
}

func convertToProtoErrorEvent(event errorEvent, traceID, spanID []byte, errType tagsv1.ErrorTags_ErrorType) (*instrumentationv1.Event, error) {
	id, err := generateEventID()
	if err != nil {
		return nil, fmt.Errorf("generate event ID: %w", err)
	}
	protoEvent := instrumentationv1.Event{
		Id:                id,
		TraceId:           traceID,
		SpanId:            spanID,
		TimestampUnixNano: uint64(event.timestamp.UnixNano()),
		EventName:         telemetryErrorGeneratedV1,
		Tags: &tagsv1.Tags{
			Error: toErrorTags(event.error, errType),
		},
	}
	return &protoEvent, nil
}

func convertToProtoWarningEvent(event warningEvent, traceID, spanID []byte) (*instrumentationv1.Event, error) {
	id, err := generateEventID()
	if err != nil {
		return nil, fmt.Errorf("generate event ID: %w", err)
	}
	warningType := tagsv1.WarningTags_WARNING_TYPE_USER
	protoEvent := instrumentationv1.Event{
		Id:                id,
		TraceId:           traceID,
		SpanId:            spanID,
		TimestampUnixNano: uint64(event.timestamp.UnixNano()),
		EventName:         telemetryWarningGeneratedV1,
		Tags: &tagsv1.Tags{
			Warning: &tagsv1.WarningTags{
				Message: event.message,
				Type:    &warningType,
			},
		},
	}
	return &protoEvent, nil
}

func toErrorTags(err error, tagErrType tagsv1.ErrorTags_ErrorType) *tagsv1.ErrorTags {
	if respErr, ok := err.(messages.InvokeResponse_Error); ok {
		return &tagsv1.ErrorTags{
			Name:    respErr.Type,
			Message: &respErr.Message,
			Type:    tagErrType,
		}
	}
	return &tagsv1.ErrorTags{
		Name:    getErrorType(err),
		Message: aws.String(err.Error()),
		Type:    tagErrType,
	}
}
