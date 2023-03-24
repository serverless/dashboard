package slslambda

import (
	"context"
	"errors"
	"github.com/aws/aws-lambda-go/lambda/messages"
	"github.com/aws/aws-lambda-go/lambdacontext"
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	instrumentationv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"time"
)

type (
	span interface {
		Span() *basicSpan
		Close(...time.Time)
		ToProto(traceID, spanID, parentSpanID []byte, requestID string, tags tags) *instrumentationv1.Span
	}
	rootContext struct {
		requestID    string
		invocation   *basicSpan
		spanTreeRoot *rootSpan
	}
)

func newRootContext(ctx context.Context, initializationStart, invocationStart time.Time) *rootContext {
	isColdStart := isColdStart(initializationStart)
	root := newRootSpan(initializationStart, invocationStart, isColdStart)
	if isColdStart {
		root.children = append(root.children, newInitializationSpan(initializationStart, invocationStart))
	}
	invocation := newSpanWithStartTime(invocationSpanName, invocationStart)
	root.children = append(root.children, invocation)
	return &rootContext{
		requestID:    requestID(ctx),
		invocation:   invocation,
		spanTreeRoot: root,
	}
}

func (rc *rootContext) captureUncaughtErr(err error) {
	if err == nil {
		return
	}
	rc.invocation.Lock()
	defer rc.invocation.Unlock()
	rc.invocation.errors = append(rc.invocation.errors, newUncaughtError(err, time.Now()))
	rc.setOutcome(err)
}

func (rc *rootContext) setOutcome(err error) {
	if respErr, ok := err.(messages.InvokeResponse_Error); ok && respErr.ShouldExit {
		rc.spanTreeRoot.outcome = tagsv1.AwsLambdaTags_OUTCOME_ERROR_UNHANDLED
		return
	}
	rc.spanTreeRoot.outcome = tagsv1.AwsLambdaTags_OUTCOME_ERROR_HANDLED
}

func isColdStart(initializationStart time.Time) bool {
	return !initializationStart.IsZero()
}

func requestID(ctx context.Context) string {
	if lambdaContext, ok := lambdacontext.FromContext(ctx); ok {
		return lambdaContext.AwsRequestID
	}
	return ""
}

func currentSpanFromContext(ctx context.Context) (*basicSpan, error) {
	span, ok := ctx.Value(currentSpanContextKey).(*basicSpan)
	if !ok {
		return nil, errors.New("no current span in context")
	}
	return span, nil
}
