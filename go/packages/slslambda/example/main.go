package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/serverless/console/go/packages/slslambda"
	"time"
)

func main() {
	slslambda.Start(handle)
}

func handle(ctx context.Context) {
	fmt.Println("hello from lambda!")
	time.Sleep(100 * time.Millisecond)

	// using context from handler, error is captured in aws.lambda.invocation span
	err := errors.New("something went wrong")
	slslambda.CaptureError(ctx, err)
	fmt.Println("error captured!")

	time.Sleep(100 * time.Millisecond)

	// using context from handler, warning is captured in aws.lambda.invocation span
	msg := "something bad will happen soon"
	slslambda.CaptureWarning(ctx, msg)
	fmt.Println("warning captured!")

	// using context from handler, tags are added to aws.lambda.invocation span
	slslambda.AddTags(ctx, map[string]string{"tag on invocation": "yes"})

	// using context from handler, a new child span is added to aws.lambda.invocation
	childCtx := slslambda.WithSpan(ctx, "child of invocation span")

	time.Sleep(50 * time.Millisecond)

	// using child context, error is captured in "child of invocation span" span
	err = errors.New("something went wrong in new span")
	slslambda.CaptureError(childCtx, err)

	time.Sleep(50 * time.Millisecond)

	// using child context, a new child span is added to "child of invocation span" span
	childOfChildCtx := slslambda.WithSpan(childCtx, "child of child")

	// using child of child context, tags are added to "child of child" span
	slslambda.AddTags(childOfChildCtx, map[string]string{"tag on span 2": "yes"})

	time.Sleep(50 * time.Millisecond)

	// closing parent span also closes all children spans (in this case "child of child" span)
	slslambda.Close(childCtx)

	time.Sleep(100 * time.Millisecond)
	fmt.Println("goodbye!")
}
