package slslambda

import (
	"github.com/aws/aws-sdk-go/aws"
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"time"
)

type rootSpan struct {
	*basicSpan
	isColdStart bool
}

func (rs *rootSpan) Span() *basicSpan {
	return rs.basicSpan
}

func newRootSpan(initializationStart, invocationStart time.Time, isColdStart bool) *rootSpan {
	return &rootSpan{
		&basicSpan{
			name:       rootSpanName,
			start:      rootSpanStartTime(isColdStart, initializationStart, invocationStart),
			customTags: map[string]string{}},
		isColdStart}
}

func (rs *rootSpan) Close(t ...time.Time) {
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
			// TODO: adjust the outcome accordingly
			Outcome: tagsv1.AwsLambdaTags_OUTCOME_SUCCESS,
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
