package wrapper

import (
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"reflect"
)

const telemetryErrorGeneratedV1 = "telemetry.error.generated.v1"

func convertToProtoEvents(events []errorEvent, traceID, spanID []byte) ([]*instrumentationv1.Event, error) {
	var protoEvents []*instrumentationv1.Event
	for _, event := range events {
		protoEvent, err := convertToProtoEvent(event, traceID, spanID)
		if err != nil {
			return nil, fmt.Errorf("convert to proto event: %w", err)
		}
		protoEvents = append(protoEvents, protoEvent)
	}
	return protoEvents, nil
}

func convertToProtoEvent(event errorEvent, traceID, spanID []byte) (*instrumentationv1.Event, error) {
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
			Error: &tagsv1.ErrorTags{
				Name:    errorType(event.err),
				Message: aws.String(event.err.Error()),
				Type:    tagsv1.ErrorTags_ERROR_TYPE_CAUGHT_USER,
			},
			Warning: nil,
			Notice:  nil,
		},
	}
	return &protoEvent, nil
}

func errorType(err error) string {
	if errorType := reflect.TypeOf(err); errorType.Kind() == reflect.Ptr {
		return errorType.Elem().Name()
	} else {
		return errorType.Name()
	}
}
