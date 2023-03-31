package main

import "github.com/aws/aws-lambda-go/lambda"

func main() {
	lambda.Start(handle)
}

func handle() (string, error) {
	return "ok", nil
}
