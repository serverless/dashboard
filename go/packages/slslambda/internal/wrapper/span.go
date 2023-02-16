package wrapper

import (
	"context"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"sync"
	"time"
)

type (
	RootSpan struct {
		requestID           string
		startTime           time.Time
		invocationStartTime time.Time
		endTime             time.Time
		errorEvents         []errorEvent

		// Mutex is needed because the consumer may add data to the span from multiple goroutines.
		sync.Mutex
	}
	errorEvent struct {
		timestamp time.Time
		err       error
	}
)

func (r *RootSpan) CaptureError(err error) {
	r.Lock()
	defer r.Unlock()
	r.errorEvents = append(r.errorEvents, errorEvent{
		timestamp: time.Now(),
		err:       err,
	})
}

func (r *RootSpan) close() {
	r.endTime = time.Now()
}

func newRootSpan(ctx context.Context, initializationStart, invocationStart time.Time) (*RootSpan, error) {
	return &RootSpan{
		requestID:           requestID(ctx),
		startTime:           rootSpanStartTime(initializationStart, invocationStart),
		invocationStartTime: invocationStart,
	}, nil
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
