package slslambda

import (
	"github.com/aws/aws-sdk-go/aws"
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"time"
)

type rootSpan struct {
	*basicSpan
	isColdStart  bool
	isHandledErr bool
}

func (rs *rootSpan) Span() *basicSpan {
	return rs.basicSpan
}

func newRootSpan(initializationStart, invocationStart time.Time, isColdStart bool) *rootSpan {
	return &rootSpan{
		basicSpan: &basicSpan{
			name:       rootSpanName,
			start:      rootSpanStartTime(isColdStart, initializationStart, invocationStart),
			customTags: map[string]string{}},
		isColdStart:  isColdStart,
		isHandledErr: false,
	}
}

func (rs *rootSpan) Close(t ...time.Time) {
	rs.basicSpan.Close(t...)
}

func (rs *rootSpan) CloseWithError(err error, t ...time.Time) {
	rs.basicSpan.Close(t...)
}

func (rs *rootSpan) ToProto(traceID, spanID, parentSpanID []byte, requestID string, tags tags) *instrumentationv1.Span {
	proto := rs.basicSpan.ToProto(traceID, spanID, parentSpanID, requestID, tags)
	proto.Tags.Aws = &tagsv1.AwsTags{
		Lambda: &tagsv1.AwsLambdaTags{
			Arch:          string(tags.Architecture),
			LogGroup:      (*string)(&tags.LogGroupName),
			LogStreamName: (*string)(&tags.LogStreamName),
			MaxMemory:     aws.Uint32(uint32(tags.MemorySize)),
			Name:          string(tags.FunctionName),
			RequestId:     requestID,
			IsColdstart:   rs.isColdStart,
			Version:       string(tags.FunctionVersion),
			Outcome:       rs.outcome(),
		},
		Region:       (*string)(&tags.AWSRegion),
		RequestId:    &requestID,
		ResourceName: (*string)(&tags.FunctionName),
		LogGroup:     (*string)(&tags.LogGroupName),
		LogStream:    (*string)(&tags.LogStreamName),
	}
	return proto
}

func rootSpanStartTime(isColdStart bool, initializationStart, invocationStart time.Time) time.Time {
	if isColdStart {
		return initializationStart
	} else {
		return invocationStart
	}
}

func (rs *rootSpan) outcome() tagsv1.AwsLambdaTags_Outcome {
	if rs.isHandledErr {
		return tagsv1.AwsLambdaTags_OUTCOME_ERROR_HANDLED
	}
	return tagsv1.AwsLambdaTags_OUTCOME_SUCCESS
}
