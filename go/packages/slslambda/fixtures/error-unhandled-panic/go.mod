module error-unhandled-panic

go 1.20

require github.com/serverless/console/go/packages/slslambda v0.0.0-20230316133037-2f4eae5de550

require (
	github.com/aws/aws-lambda-go v1.38.0 // indirect
	github.com/aws/aws-sdk-go v1.44.222 // indirect
	go.buf.build/protocolbuffers/go/serverless/sdk-schema v1.3.27 // indirect
	google.golang.org/protobuf v1.30.0 // indirect
)

replace github.com/serverless/console/go/packages/slslambda v0.0.0-20230316133037-2f4eae5de550 => ../..
