package wrapper

import (
	"context"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/serverless/console/go/packages/slslambda"
	"github.com/serverless/console/go/packages/slslambda/internal/environment"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"strconv"
	"time"
)

type contextKey struct{}

type BytesHandlerFunc func(context.Context, []byte) ([]byte, error)

func (f BytesHandlerFunc) Invoke(ctx context.Context, payload []byte) ([]byte, error) {
	return f(ctx, payload)
}

type Wrapper struct {
	Environment    string
	organizationID environment.OrganizationID
}

func New(options ...slslambda.Option) (*Wrapper, error) {
	w := &Wrapper{organizationID: environment.GetOrganizationID()}
	for _, o := range options {
		o(w)
	}
	if w.organizationID == "" {
		return nil, fmt.Errorf("missing %s environment variable", environment.OrganizationIDEnvVarName)
	}
	return w, nil
}

func (w Wrapper) Wrap(handler BytesHandlerFunc, initializationStart time.Time) BytesHandlerFunc {
	tags := environment.GetTags()
	return func(ctx context.Context, payload []byte) ([]byte, error) {
		rootSpan, err := newRootSpan(ctx, initializationStart, time.Now())
		if err != nil {
			fmt.Print(fmt.Errorf("new span: %w", err))
		}
		ctx = context.WithValue(ctx, contextKey{}, rootSpan)
		output, err := handler(ctx, payload)
		rootSpan.Close(time.Now())
		if err := w.printTrace(tags, rootSpan); err != nil {
			fmt.Print(fmt.Errorf("print trace: %w", err))
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
			Aws: &tagsv1.AwsTags{
				Lambda: &tagsv1.AwsLambdaTags{
					Arch:          string(tags.Architecture),
					LogGroup:      (*string)(&tags.LogGroupName),
					LogStreamName: (*string)(&tags.LogStreamName),
					MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
					Name:          string(tags.FunctionName),
					RequestId:     rootSpan.requestID,
					Version:       strconv.Itoa(int(tags.FunctionVersion)),
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
				Aws: &tagsv1.AwsTags{
					Lambda: &tagsv1.AwsLambdaTags{
						Arch:          string(tags.Architecture),
						IsColdstart:   true,
						LogGroup:      (*string)(&tags.LogGroupName),
						LogStreamName: (*string)(&tags.LogStreamName),
						MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
						Name:          string(tags.FunctionName),
						RequestId:     rootSpan.requestID,
						Version:       strconv.Itoa(int(tags.FunctionVersion)),
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
		Id:                rootSpanID,
		TraceId:           traceID,
		ParentSpanId:      nil,
		Name:              rootSpanName,
		StartTimeUnixNano: uint64(rootSpan.invocationStartTime.UnixNano()),
		EndTimeUnixNano:   uint64(rootSpan.endTime.UnixNano()),
		Tags: &tagsv1.Tags{
			Aws: &tagsv1.AwsTags{
				Lambda: &tagsv1.AwsLambdaTags{
					Arch:           string(tags.Architecture),
					IsColdstart:    false,
					LogGroup:       (*string)(&tags.LogGroupName),
					LogStreamName:  (*string)(&tags.LogStreamName),
					MaxMemory:      aws.Uint32(uint32(tags.MemorySize)),
					Name:           string(tags.FunctionName),
					RequestId:      rootSpan.requestID,
					Version:        strconv.Itoa(int(tags.FunctionVersion)),
					Outcome:        0,
					Initialization: &tagsv1.AwsLambdaInitializationTags{},
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
