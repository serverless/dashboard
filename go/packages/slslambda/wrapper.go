package slslambda

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	instrumentationv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
)

type bytesHandlerFunc func(context.Context, []byte) ([]byte, error)

func (f bytesHandlerFunc) Invoke(ctx context.Context, payload []byte) ([]byte, error) {
	return f(ctx, payload)
}

type wrapper struct {
	environment string
	tags        tags
}

// An unexported type to be used as the key for types in this package.
// This prevents collisions with keys defined in other packages.
type key struct{}

// contextKey is the key for a rootSpan in Contexts.
// Users of this package must use slslambda.FromContext
// instead of using this key directly.
var contextKey = &key{}

func newWrapper(options ...func(c *wrapper)) (*wrapper, error) {
	tags, err := getTags()
	if err != nil {
		return nil, fmt.Errorf("get tags: %w", err)
	}
	w := &wrapper{tags: tags}
	for _, o := range options {
		o(w)
	}
	return w, nil
}

func (w wrapper) Wrap(userHandler lambda.Handler, initializationStart time.Time) bytesHandlerFunc {
	return func(ctx context.Context, payload []byte) (output []byte, userHandlerErr error) {
		userHandlerInvoked := false
		defer func() {
			if r := recover(); r != nil {
				debugLog("recover panic in wrapped handler:", r, "\n", string(debug.Stack()))
				if !userHandlerInvoked {
					// invoke user handler with regular lambda context if it hasn't been called yet
					// and return its outputs via named return values
					output, userHandlerErr = userHandler.Invoke(ctx, payload)
				}
			}
		}()

		slsCtx := ctxWithRootSpan(ctx, initializationStart)

		output, userHandlerErr = userHandler.Invoke(slsCtx, payload)
		userHandlerInvoked = true

		if err := w.closeRootSpan(slsCtx); err != nil {
			debugLog("closeRootSpan:", err)
		}

		// reset initialization start time
		initializationStart = time.Time{}

		// return outputs from user handler
		return output, userHandlerErr
	}
}

func ctxWithRootSpan(ctx context.Context, initializationStart time.Time) context.Context {
	spanCtx := newSpanContext(ctx, initializationStart, time.Now())
	return context.WithValue(ctx, contextKey, spanCtx)
}

func (w wrapper) closeRootSpan(ctx context.Context) error {
	spanCtx, err := fromContext(ctx)
	if err != nil {
		return fmt.Errorf("close root span: %w", err)
	}

	span := spanCtx.rootSpan
	span.close()
	if err := w.printTrace(spanCtx); err != nil {
		return fmt.Errorf("print trace: %w", err)
	}
	return nil
}

func convert(spanCtx *spanContext, tags tags, environment string) (*instrumentationv1.TracePayload, error) {
	protoSpans, err := convertToProtoSpans(spanCtx, tags)
	if err != nil {
		return nil, fmt.Errorf("convert to proto spans: %w", err)
	}
	invocationSpan := invocationProtoSpan(protoSpans)
	if invocationSpan == nil {
		return nil, errors.New("invocation proto span not found")
	}

	span := spanCtx.rootSpan

	protoEvents, err := convertToProtoEvents(span.errorEvents, span.warningEvents, invocationSpan.TraceId, invocationSpan.Id)
	if err != nil {
		return nil, fmt.Errorf("convert error events to proto events: %w", err)
	}
	payload := instrumentationv1.TracePayload{
		SlsTags: slsTags(tags, environment),
		Spans:   protoSpans,
		Events:  protoEvents,
	}
	return &payload, nil
}

func convertToProtoSpans(spanCtx *spanContext, tags tags) ([]*instrumentationv1.Span, error) {
	rootSpan := spanCtx.rootSpan
	var spans []*instrumentationv1.Span
	rootSpanID, err := generateSpanID()
	if err != nil {
		return nil, fmt.Errorf("generate span ID: %w", err)
	}
	traceID, err := generateTraceID()
	if err != nil {
		return nil, fmt.Errorf("generate trace ID: %w", err)
	}
	rootProtoSpan := instrumentationv1.Span{
		Id:                rootSpanID,
		TraceId:           traceID,
		ParentSpanId:      nil,
		Name:              rootSpanName,
		StartTimeUnixNano: uint64(rootSpan.startTime.UnixNano()),
		EndTimeUnixNano:   uint64(rootSpan.endTime.UnixNano()),
		Tags: &tagsv1.Tags{
			OrgId: (*string)(&tags.OrganizationID),
			Aws: &tagsv1.AwsTags{
				Lambda: &tagsv1.AwsLambdaTags{
					Arch:          string(tags.Architecture),
					LogGroup:      (*string)(&tags.LogGroupName),
					LogStreamName: (*string)(&tags.LogStreamName),
					MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
					Name:          string(tags.FunctionName),
					RequestId:     rootSpan.requestID,
					Version:       string(tags.FunctionVersion),
				},
				Region:       (*string)(&tags.AWSRegion),
				RequestId:    &rootSpan.requestID,
				ResourceName: (*string)(&tags.FunctionName),
				LogGroup:     (*string)(&tags.LogGroupName),
				LogStream:    (*string)(&tags.LogStreamName),
			},
		},
	}
	spans = append(spans, &rootProtoSpan)

	if isColdStart := rootSpan.startTime != rootSpan.invocationStartTime; isColdStart {
		spanID, err := generateSpanID()
		if err != nil {
			return nil, fmt.Errorf("generate span ID: %w", err)
		}
		initializationProtoSpan := instrumentationv1.Span{
			Id:                spanID,
			TraceId:           traceID,
			ParentSpanId:      rootProtoSpan.Id,
			Name:              initializationSpanName,
			StartTimeUnixNano: rootProtoSpan.StartTimeUnixNano,
			EndTimeUnixNano:   uint64(rootSpan.invocationStartTime.UnixNano()),
			Tags: &tagsv1.Tags{
				OrgId: (*string)(&tags.OrganizationID),
				Aws: &tagsv1.AwsTags{
					Lambda: &tagsv1.AwsLambdaTags{
						Arch:          string(tags.Architecture),
						IsColdstart:   true,
						LogGroup:      (*string)(&tags.LogGroupName),
						LogStreamName: (*string)(&tags.LogStreamName),
						MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
						Name:          string(tags.FunctionName),
						RequestId:     rootSpan.requestID,
						Version:       string(tags.FunctionVersion),
						Initialization: &tagsv1.AwsLambdaInitializationTags{
							InitializationDuration: uint32(rootSpan.invocationStartTime.Sub(rootSpan.startTime).Milliseconds()),
						},
					},
					Region:       (*string)(&tags.AWSRegion),
					RequestId:    &rootSpan.requestID,
					ResourceName: (*string)(&tags.FunctionName),
					LogGroup:     (*string)(&tags.LogGroupName),
					LogStream:    (*string)(&tags.LogStreamName),
				},
			},
		}
		spans = append(spans, &initializationProtoSpan)
	}
	invocationProtoSpan := instrumentationv1.Span{
		Id:                spanCtx.invocationSpanId,
		TraceId:           traceID,
		ParentSpanId:      rootProtoSpan.Id,
		Name:              invocationSpanName,
		StartTimeUnixNano: uint64(rootSpan.invocationStartTime.UnixNano()),
		EndTimeUnixNano:   uint64(rootSpan.endTime.UnixNano()),
		Tags: &tagsv1.Tags{
			OrgId: (*string)(&tags.OrganizationID),
			Aws: &tagsv1.AwsTags{
				Lambda: &tagsv1.AwsLambdaTags{
					Arch:          string(tags.Architecture),
					LogGroup:      (*string)(&tags.LogGroupName),
					LogStreamName: (*string)(&tags.LogStreamName),
					MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
					Name:          string(tags.FunctionName),
					RequestId:     rootSpan.requestID,
					Version:       string(tags.FunctionVersion),
				},
				Region:       (*string)(&tags.AWSRegion),
				RequestId:    &rootSpan.requestID,
				ResourceName: (*string)(&tags.FunctionName),
				LogGroup:     (*string)(&tags.LogGroupName),
				LogStream:    (*string)(&tags.LogStreamName),
			},
		},
	}
	spans = append(spans, &invocationProtoSpan)

	for _, userSpan := range spanCtx.userSpans {
		spans = append(spans, convertUserSpans(userSpan, traceID, (*string)(&tags.OrganizationID))...)
	}

	return spans, nil
}

func convertUserSpan(span *UserSpan, traceId []byte, orgId *string) *instrumentationv1.Span {
	newSpan := instrumentationv1.Span{
		Id:                span.id,
		TraceId:           traceId,
		ParentSpanId:      span.parentSpanId,
		Name:              span.name,
		StartTimeUnixNano: uint64(span.startTime.UnixNano()),
		EndTimeUnixNano:   uint64(span.endTime.UnixNano()),
		CustomTags:        span.marshalCustomTags(),
		Tags: &tagsv1.Tags{
			OrgId: orgId,
		},
	}

	return &newSpan
}

func convertUserSpans(rootSpan *UserSpan, traceId []byte, orgId *string) []*instrumentationv1.Span {

	if len(rootSpan.childSpans) == 0 {
		return []*instrumentationv1.Span{convertUserSpan(rootSpan, traceId, orgId)}
	}

	spans := make([]*instrumentationv1.Span, 0)

	spans = append(spans, convertUserSpan(rootSpan, traceId, orgId))
	for _, span := range rootSpan.childSpans {
		spans = append(spans, convertUserSpans(span, traceId, orgId)...)
	}

	return spans
}

func invocationProtoSpan(spans []*instrumentationv1.Span) *instrumentationv1.Span {
	for _, span := range spans {
		if span.Name == invocationSpanName {
			return span
		}
	}
	return nil
}
