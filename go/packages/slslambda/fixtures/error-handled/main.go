package main

import (
	"errors"
	"github.com/serverless/console/go/packages/slslambda"
)

func main() {
	slslambda.Start(handle)
}

func handle() (string, error) {
	return "", errors.New("sth went wrong")
}
