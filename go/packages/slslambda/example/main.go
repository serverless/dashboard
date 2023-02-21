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

	err := errors.New("something went wrong")
	slslambda.CaptureError(ctx, err)
	fmt.Println("error captured!")

	time.Sleep(100 * time.Millisecond)

	msg := "something bad will happen soon"
	slslambda.CaptureWarning(ctx, msg)
	fmt.Println("warning captured!")

	time.Sleep(100 * time.Millisecond)
	fmt.Println("goodbye!")
}
