package slslambda

import (
	"context"
	"runtime/debug"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
)

var initializationStart = time.Now()

// Start starts handler function with Serverless instrumentation.
func Start(handlerFunc any, options ...Option) {
	lambda.Start(wrap(handlerFunc, options))
}

func wrap(userHandlerFunc any, options []Option) (handlerFunc any) {
	defer func() {
		if r := recover(); r != nil {
			debugLog("recover panic in wrap:", r, string(debug.Stack()))
			// return user handler
			handlerFunc = userHandlerFunc
		}
	}()
	w, err := newWrapper(options...)
	if err != nil {
		debugLog("cannot instrument function:", err)
		// return user handler
		return userHandlerFunc
	}
	return w.Wrap(lambda.NewHandler(userHandlerFunc), initializationStart)
}

// Option is used to customize the instrumentation.
type Option = func(c *wrapper)

// WithEnvironment allows for associating custom environment with telemetry data sent.
func WithEnvironment(env string) Option {
	return func(w *wrapper) {
		w.environment = env
	}
}

func CaptureError(ctx context.Context, err error) {
	spanCtx, ctxErr := fromContext(ctx)
	if ctxErr != nil {
		debugLog("capture error:", ctxErr)
		return
	}
	span := spanCtx.rootSpan
	span.captureError(err)
}

func CaptureWarning(ctx context.Context, msg string) {
	spanCtx, ctxErr := fromContext(ctx)
	if ctxErr != nil {
		debugLog("capture warning:", ctxErr)
		return
	}

	span := spanCtx.rootSpan
	span.captureWarning(msg)
}

// A span that will always be attached to the invocation span.
func StartSpan(ctx context.Context, name string) *UserSpan {
	spanCtx, ctxErr := fromContext(ctx)
	if ctxErr != nil {
		debugLog("start user span:", ctxErr)
		return nil
	}

	userSpan := spanCtx.newCustomSpan(name)

	spanCtx.userSpans = append(spanCtx.userSpans, userSpan)

	return userSpan
}
