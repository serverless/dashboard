module error-handled

go 1.20

require github.com/serverless/console/go/packages/slslambda v0.0.0-20230316133037-2f4eae5de550

require (
	buf.build/gen/go/serverless/sdk-schema/protocolbuffers/go v1.31.0-20230718154650-050338f58701.1 // indirect
	github.com/aws/aws-lambda-go v1.38.0 // indirect
	github.com/aws/aws-sdk-go v1.44.222 // indirect
	google.golang.org/protobuf v1.31.0 // indirect
)

replace github.com/serverless/console/go/packages/slslambda v0.0.0-20230316133037-2f4eae5de550 => ../..
