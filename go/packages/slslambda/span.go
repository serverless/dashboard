package slslambda

import (
	"context"
	"errors"
	"github.com/aws/aws-lambda-go/lambdacontext"
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
	errorEvent struct {
		timestamp time.Time
		error
	}
	warningEvent struct {
		timestamp time.Time
		message   string
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

func isColdStart(initializationStart time.Time) bool {
	return !initializationStart.IsZero()
}

func requestID(ctx context.Context) string {
	if lambdaContext, ok := lambdacontext.FromContext(ctx); ok {
		return lambdaContext.AwsRequestID
	}
	return ""
}

func rootFromContext(ctx context.Context) (*rootContext, error) {
	span, ok := ctx.Value(rootContextKey).(*rootContext)
	if !ok {
		return nil, errors.New("no root span in context")
	}
	return span, nil
}

func currentSpanFromContext(ctx context.Context) (*basicSpan, error) {
	span, ok := ctx.Value(currentSpanContextKey).(*basicSpan)
	if !ok {
		return nil, errors.New("no current span in context")
	}
	return span, nil
}
