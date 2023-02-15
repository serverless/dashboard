package slslambda

import (
	"context"
	"fmt"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/serverless/console/go/packages/slslambda/internal/wrapper"
	"time"
)

var initializationStart = time.Now()

// An unexported type to be used as the key for types in this package.
// This prevents collisions with keys defined in other packages.
type key struct{}

// The key for a LambdaContext in Contexts.
// Users of this package must use slslambda.FromContext
// instead of using this key directly.
var contextKey = &key{}

type Span interface {
	CaptureError(error)
}

// Start starts handler function with serverless instrumentation.
func Start(handler any, options ...Option) {
	h := lambda.NewHandler(handler)
	w, err := wrapper.New(options...)
	if err != nil {
		fmt.Print(fmt.Errorf("cannot instrument function: %w", err))
	} else {
		h = w.Wrap(h.Invoke, initializationStart)
	}
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
	span, ok := ctx.Value(contextKey).(*wrapper.RootSpan)
	if !ok {
		return noopSpan{}
	}
	return span
}

type noopSpan struct{}

func (n noopSpan) CaptureError(error) {
	fmt.Print("couldn't get Span from context: using noop span")
}
