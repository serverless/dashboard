package main

import "github.com/serverless/console/go/packages/slslambda"

func main() {
	slslambda.Start(handle)
}

func handle() (string, error) {
	return "ok", nil
}
