package slslambda

import (
	"context"
	"errors"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"sync"
	"time"
)

type (
	rootSpan struct {
		requestID           string
		startTime           time.Time
		invocationStartTime time.Time
		endTime             time.Time
		errorEvents         []errorEvent
		warningEvents       []warningEvent

		// Mutex is needed because the consumer may add data to the span from multiple goroutines.
		sync.Mutex
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

func (r *rootSpan) captureError(err error) {
	r.Lock()
	defer r.Unlock()
	r.errorEvents = append(r.errorEvents, errorEvent{
		timestamp: time.Now(),
		error:     err,
	})
}

func (r *rootSpan) captureWarning(msg string) {
	r.Lock()
	defer r.Unlock()
	r.warningEvents = append(r.warningEvents, warningEvent{
		timestamp: time.Now(),
		message:   msg,
	})
}

func (r *rootSpan) close() {
	r.endTime = time.Now()
}

func newRootSpan(ctx context.Context, initializationStart, invocationStart time.Time) *rootSpan {
	return &rootSpan{
		requestID:           requestID(ctx),
		startTime:           rootSpanStartTime(initializationStart, invocationStart),
		invocationStartTime: invocationStart,
	}
}

func requestID(ctx context.Context) string {
	if lambdaContext, ok := lambdacontext.FromContext(ctx); ok {
		return lambdaContext.AwsRequestID
	}
	return ""
}

func rootSpanStartTime(initializationStart, invocationStart time.Time) time.Time {
	if isColdStart(initializationStart) {
		return initializationStart
	} else {
		return invocationStart
	}
}

func isColdStart(initializationStart time.Time) bool {
	return !initializationStart.IsZero()
}

func fromContext(ctx context.Context) (*rootSpan, error) {
	span, ok := ctx.Value(contextKey).(*rootSpan)
	if !ok {
		return nil, errors.New("no root span in context")
	}
	return span, nil
}
