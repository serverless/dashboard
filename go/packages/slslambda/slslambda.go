package slslambda

import (
	"context"
	"fmt"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/serverless/console/go/packages/slslambda/internal/log"
	"github.com/serverless/console/go/packages/slslambda/internal/wrapper"
	"time"
)

var initializationStart = time.Now()

type Span interface {
	CaptureError(error)
}

// Start starts handler function with serverless instrumentation.
func Start(handler any, options ...Option) {
	h := lambda.NewHandler(handler)
	w, err := wrapper.New(options...)
	if err != nil {
		log.Debug(fmt.Errorf("cannot instrument function: %w", err))
		lambda.Start(handler)
	}
	h = w.Wrap(h.Invoke, initializationStart)
	lambda.Start(h)
}

// Option is used to customize the instrumentation.
type Option = func(c *wrapper.Wrapper)

// WithEnvironment allows for associating custom environment with telemetry data sent.
func WithEnvironment(env string) Option {
	return func(w *wrapper.Wrapper) {
		w.Environment = env
	}
}

func FromContext(ctx context.Context) Span {
	span, ok := ctx.Value(wrapper.ContextKey).(*wrapper.RootSpan)
	if !ok {
		return noopSpan{}
	}
	return span
}

type noopSpan struct{}

func (n noopSpan) CaptureError(error) {
	log.Debug("couldn't get Span from context: using noop span")
}
