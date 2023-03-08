package slslambda

import (
	"context"
	"encoding/json"
	"github.com/aws/aws-sdk-go/aws"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"sync"
	"time"
)

type basicSpan struct {
	name       string
	start      time.Time
	end        time.Time
	children   []span
	customTags map[string]string
	errors     []errorEvent
	warnings   []warningEvent

	// Mutex is needed because the consumer may add data to the span from multiple goroutines.
	sync.Mutex
}

func (s *basicSpan) Span() *basicSpan {
	return s
}

func newSpan(name string) *basicSpan {
	return &basicSpan{name: name, start: time.Now(), customTags: map[string]string{}}
}

func newSpanWithStartTime(name string, start time.Time) *basicSpan {
	return &basicSpan{name: name, start: start, customTags: map[string]string{}}
}

func (s *basicSpan) Close() {
	s.Lock()
	defer s.Unlock()
	if s.end.IsZero() {
		s.end = time.Now()
		for _, child := range s.children {
			child.Close()
		}
	}
}

func (s *basicSpan) ToProto(traceID, spanID, parentSpanID []byte, requestID string, tags tags) *instrumentationv1.Span {
	return &instrumentationv1.Span{
		Id:                spanID,
		TraceId:           traceID,
		ParentSpanId:      parentSpanID,
		Name:              s.name,
		StartTimeUnixNano: uint64(s.start.UnixNano()),
		EndTimeUnixNano:   uint64(s.end.UnixNano()),
		CustomTags:        convertCustomTags(s.customTags),
		Tags: &tagsv1.Tags{
			OrgId: (*string)(&tags.OrganizationID),
			Aws: &tagsv1.AwsTags{
				Lambda: &tagsv1.AwsLambdaTags{
					Arch:          string(tags.Architecture),
					LogGroup:      (*string)(&tags.LogGroupName),
					LogStreamName: (*string)(&tags.LogStreamName),
					MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
					Name:          string(tags.FunctionName),
					RequestId:     requestID,
					Version:       string(tags.FunctionVersion),
				},
				Region:       (*string)(&tags.AWSRegion),
				RequestId:    &requestID,
				ResourceName: (*string)(&tags.FunctionName),
				LogGroup:     (*string)(&tags.LogGroupName),
				LogStream:    (*string)(&tags.LogStreamName),
			},
		},
	}
}

func (s *basicSpan) newChild(ctx context.Context, name string) context.Context {
	s.Lock()
	defer s.Unlock()
	span := newSpan(name)
	s.children = append(s.children, span)
	return context.WithValue(ctx, currentSpanContextKey, span)
}
func (s *basicSpan) captureError(err error) {
	s.Lock()
	defer s.Unlock()
	s.errors = append(s.errors, errorEvent{
		timestamp: time.Now(),
		error:     err,
	})
}

func (s *basicSpan) captureWarning(msg string) {
	s.Lock()
	defer s.Unlock()
	s.warnings = append(s.warnings, warningEvent{
		timestamp: time.Now(),
		message:   msg,
	})
}

func (s *basicSpan) addTags(tags map[string]string) {
	s.Lock()
	defer s.Unlock()
	for k, v := range tags {
		s.customTags[k] = v
	}
}

func convertCustomTags(customTags map[string]string) *string {
	b, err := json.Marshal(customTags)
	if err != nil {
		debugLog("marshalCustomTags:", err)
		return nil
	}
	return aws.String(string(b))
}
