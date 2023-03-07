package slslambda

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/lambdacontext"
)

type (
	spanContext struct {
		rootSpan         *rootSpan
		userSpans        []*UserSpan
		invocationSpanId []byte
	}
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
	UserSpan struct {
		parentSpanId []byte
		id           []byte
		name         string
		startTime    time.Time
		endTime      time.Time
		closed       bool
		customTags   map[string]string
		childSpans   []*UserSpan
		sync.Mutex
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

func (u *UserSpan) AddTag(key string, value string) {
	u.Lock()
	defer u.Unlock()
	if u.customTags == nil {
		u.customTags = make(map[string]string)
	}

	u.customTags[key] = value
}

func (u *UserSpan) AddTags(tags map[string]string) {
	u.Lock()
	defer u.Unlock()
	if u.customTags == nil {
		u.customTags = make(map[string]string)
	}

	for k, v := range tags {
		u.customTags[k] = v
	}
}

func (u *UserSpan) Close(ctx context.Context) {
	if !u.closed {
		u.endTime = time.Now()
		u.closed = true
	}
}

func (u *UserSpan) marshalCustomTags() *string {
	if u.customTags != nil && len(u.customTags) > 0 {
		b, err := json.Marshal(u.customTags)

		if err != nil {
			debugLog("marshalCustomTags:", err)
			return nil
		}

		s := string(b)
		return &s
	}

	return nil
}

func newSpanContext(ctx context.Context, initializationStart, invocationStart time.Time) *spanContext {
	rSpan := newRootSpan(ctx, initializationStart, invocationStart)
	invocationSpanId, err := generateSpanID()
	if err != nil {
		return nil
	}
	spanCtx := &spanContext{
		rootSpan:         rSpan,
		invocationSpanId: invocationSpanId,
	}

	return spanCtx
}

func newRootSpan(ctx context.Context, initializationStart, invocationStart time.Time) *rootSpan {
	return &rootSpan{
		requestID:           requestID(ctx),
		startTime:           rootSpanStartTime(initializationStart, invocationStart),
		invocationStartTime: invocationStart,
	}
}

// Will always create a span that is a direct child of the invocation span.
func (c *spanContext) newCustomSpan(name string) *UserSpan {
	span := &UserSpan{}

	id, _ := generateSpanID()

	span.id = id
	span.name = name
	span.startTime = time.Now()
	span.parentSpanId = c.invocationSpanId

	return span
}

func (u *UserSpan) StartChildSpan(name string) *UserSpan {
	span := &UserSpan{}
	span.name = name
	span.startTime = time.Now()

	id, _ := generateSpanID()

	span.id = id
	span.parentSpanId = u.id

	u.childSpans = append(u.childSpans, span)

	return span
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

func fromContext(ctx context.Context) (*spanContext, error) {
	spanCtx, ok := ctx.Value(contextKey).(*spanContext)
	if !ok {
		return nil, errors.New("no root span in context")
	}
	return spanCtx, nil
}
