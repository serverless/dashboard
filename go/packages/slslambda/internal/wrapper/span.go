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
		mu                  sync.Mutex
	}
	errorEvent struct {
		timestamp time.Time
		err       error
	}
)

func (r *RootSpan) CaptureError(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.errorEvents = append(r.errorEvents, errorEvent{
		timestamp: time.Now(),
		err:       err,
	})
}

func (r *RootSpan) Close(endTime time.Time) {
	r.endTime = endTime
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
