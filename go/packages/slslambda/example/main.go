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

	span := slslambda.FromContext(ctx)
	err := errors.New("something went wrong")
	span.CaptureError(err)
	fmt.Println("error captured!")

	time.Sleep(100 * time.Millisecond)
	fmt.Println("goodbye!")
}
