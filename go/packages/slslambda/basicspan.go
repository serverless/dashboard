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

func (s *basicSpan) Close(t ...time.Time) {
	s.Lock()
	defer s.Unlock()
	if s.end.IsZero() {
		s.end = endTime(t...)
		for _, child := range s.children {
			child.Close(s.end)
		}
	}
}

func endTime(t ...time.Time) time.Time {
	if len(t) > 0 {
		return t[0]
	}
	return time.Now()
}

func (s *basicSpan) ToProto(traceID, spanID, parentSpanID []byte, _ string, tags tags) *instrumentationv1.Span {
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
