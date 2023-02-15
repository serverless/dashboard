package wrapper

import (
	"context"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/serverless/console/go/packages/slslambda/internal/environment"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"time"
)

type BytesHandlerFunc func(context.Context, []byte) ([]byte, error)

func (f BytesHandlerFunc) Invoke(ctx context.Context, payload []byte) ([]byte, error) {
	return f(ctx, payload)
}

type Wrapper struct {
	Environment string
	tags        environment.Tags
}

// An unexported type to be used as the key for types in this package.
// This prevents collisions with keys defined in other packages.
type key struct{}

// ContextKey is the key for a LambdaContext in Contexts.
// Users of this package must use slslambda.FromContext
// instead of using this key directly.
var ContextKey = &key{}

func New(options ...func(c *Wrapper)) (*Wrapper, error) {
	tags, err := environment.GetTags()
	if err != nil {
		return nil, fmt.Errorf("get tags: %w", err)
	}
	w := &Wrapper{tags: tags}
	for _, o := range options {
		o(w)
	}
	return w, nil
}

func (w Wrapper) Wrap(handler BytesHandlerFunc, initializationStart time.Time) BytesHandlerFunc {
	return func(ctx context.Context, payload []byte) ([]byte, error) {
		rootSpan, err := newRootSpan(ctx, initializationStart, time.Now())
		if err != nil {
			fmt.Println(fmt.Errorf("new span: %w", err))
			return handler(ctx, payload)
		}
		slsCtx := context.WithValue(ctx, ContextKey, rootSpan)
		output, err := handler(slsCtx, payload)
		rootSpan.Close(time.Now())
		if err := w.printTrace(rootSpan); err != nil {
			fmt.Println(fmt.Errorf("print trace: %w", err))
		}
		initializationStart = time.Time{}
		return output, err
	}
}

func convert(span *RootSpan, tags environment.Tags, environment string) (*instrumentationv1.TracePayload, error) {
	protoSpans, err := convertToProtoSpans(span, tags)
	if err != nil {
		return nil, fmt.Errorf("convert to proto spans: %w", err)
	}
	invocationSpan := invocationProtoSpan(protoSpans)
	if invocationSpan == nil {
		return nil, errors.New("invocation proto span not found")
	}
	protoEvents, err := convertToProtoEvents(span.errorEvents, invocationSpan.TraceId, invocationSpan.Id)
	payload := instrumentationv1.TracePayload{
		SlsTags: slsTags(tags, environment),
		Spans:   protoSpans,
		Events:  protoEvents,
	}
	return &payload, nil
}

func convertToProtoSpans(rootSpan *RootSpan, tags environment.Tags) ([]*instrumentationv1.Span, error) {
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
	spanID, err := generateSpanID()
	if err != nil {
		return nil, fmt.Errorf("generate span ID: %w", err)
	}
	invocationProtoSpan := instrumentationv1.Span{
		Id:                spanID,
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
	return spans, nil
}

func invocationProtoSpan(spans []*instrumentationv1.Span) *instrumentationv1.Span {
	for _, span := range spans {
		if span.Name == invocationSpanName {
			return span
		}
	}
	return nil
}
