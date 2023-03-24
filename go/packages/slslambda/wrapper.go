package slslambda

import (
	"context"
	"fmt"
	"github.com/aws/aws-lambda-go/lambda"
	"go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"runtime/debug"
	"time"
)

type bytesHandlerFunc func(context.Context, []byte) ([]byte, error)

func (f bytesHandlerFunc) Invoke(ctx context.Context, payload []byte) ([]byte, error) {
	return f(ctx, payload)
}

type wrapper struct {
	environment string
	tags        tags
}

type (
	// An unexported type to be used as the key for types in this package.
	// This prevents collisions with keys defined in other packages.
	rootContextKeyStruct        struct{}
	currentSpanContextKeyStruct struct{}
)

var (
	// rootContextKey is the key for a rootContext in Contexts.
	// Users of this package must use slslambda.FromContext
	// instead of using this key directly.
	rootContextKey        = &rootContextKeyStruct{}
	currentSpanContextKey = &currentSpanContextKeyStruct{}
)

type spansEvents struct {
	spans  []*instrumentationv1.Span
	events []*instrumentationv1.Event
}

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

		slsCtx, rootCtx := ctxWithRootSpan(ctx, initializationStart)

		output, userHandlerErr = invoke(slsCtx, userHandler, payload)
		userHandlerInvoked = true

		rootCtx.captureUncaughtErr(userHandlerErr)
		if err := w.closeRootSpan(rootCtx); err != nil {
			debugLog("closeRootSpan:", err)
		}

		// reset initialization start time
		initializationStart = time.Time{}

		// return outputs from user handler
		return output, userHandlerErr
	}
}

func invoke(slsCtx context.Context, userHandler lambda.Handler, payload []byte) (output []byte, userHandlerErr error) {
	defer func() {
		if r := recover(); r != nil {
			userHandlerErr = lambdaPanicResponse(r)
		}
	}()
	return userHandler.Invoke(slsCtx, payload)
}

func ctxWithRootSpan(ctx context.Context, initializationStart time.Time) (context.Context, *rootContext) {
	rootCtx := newRootContext(ctx, initializationStart, time.Now())
	withRootCtx := context.WithValue(ctx, rootContextKey, rootCtx)
	return context.WithValue(withRootCtx, currentSpanContextKey, rootCtx.invocation), rootCtx
}

func (w wrapper) closeRootSpan(rootCtx *rootContext) error {
	rootCtx.spanTreeRoot.Close()
	if err := w.printTrace(rootCtx); err != nil {
		return fmt.Errorf("print trace: %w", err)
	}
	return nil
}

func convertToPayload(spanTreeRoot *rootSpan, requestID, environment string, tags tags) (*instrumentationv1.TracePayload, error) {
	traceID, err := generateTraceID()
	if err != nil {
		return nil, fmt.Errorf("generate trace ID: %w", err)
	}
	proto, err := convertToProto(spanTreeRoot, traceID, nil, requestID, tags)
	if err != nil {
		return nil, fmt.Errorf("convert span tree root to proto: %w", err)
	}
	return &instrumentationv1.TracePayload{
		SlsTags: slsTags(tags, environment),
		Spans:   proto.spans,
		Events:  proto.events,
	}, nil
}

func convertToProto(span span, traceID, parentSpanID []byte, requestID string, tags tags) (spansEvents, error) {
	spanID, err := generateSpanID()
	if err != nil {
		return spansEvents{}, fmt.Errorf("generate span ID: %w", err)
	}
	protoSpan := span.ToProto(traceID, spanID, parentSpanID, requestID, tags)
	protoEvents, err := convertToProtoEvents(span.Span().errors, span.Span().warnings, traceID, spanID)
	if err != nil {
		return spansEvents{}, fmt.Errorf("convert to proto events: %w", err)
	}
	protoSpans := []*instrumentationv1.Span{protoSpan}
	for _, span := range span.Span().children {
		childrenProto, err := convertToProto(span, traceID, protoSpan.Id, requestID, tags)
		if err != nil {
			return spansEvents{}, fmt.Errorf("convert span to proto: %w", err)
		}
		protoSpans = append(protoSpans, childrenProto.spans...)
		protoEvents = append(protoEvents, childrenProto.events...)
	}
	return spansEvents{spans: protoSpans, events: protoEvents}, nil
}
