package wrapper

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/serverless/console/go/packages/slslambda/internal/environment"
	"github.com/serverless/console/go/packages/slslambda/internal/log"
	tagsv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/tags/v1"
	instrumentationv1 "go.buf.build/protocolbuffers/go/serverless/sdk-schema/serverless/instrumentation/v1"
	"google.golang.org/protobuf/proto"
)

const (
	tracePayloadPrefix     = "SERVERLESS_TELEMETRY.T."
	lambdaPlatform         = "lambda"
	sdkName                = "aws-lambda-sdk"
	rootSpanName           = "aws.lambda"
	initializationSpanName = "aws.lambda.initialization"
	invocationSpanName     = "aws.lambda.invocation"
	spanIDBytesLength      = 8
	traceIDBytesLength     = 16
	eventIDBytesLength     = 16
)

var version = "undefined"

func (w Wrapper) printTrace(span *RootSpan) error {
	payload, err := convert(span, w.tags, w.Environment)
	if err != nil {
		return fmt.Errorf("convert: %w", err)
	}
	printServerlessTelemetryLogLine(payload)
	return nil
}

func slsTags(tags environment.Tags, environment string) *tagsv1.SlsTags {
	return &tagsv1.SlsTags{
		OrgId:    string(tags.OrganizationID),
		Platform: aws.String(lambdaPlatform),
		Service:  string(tags.FunctionName),
		Region:   aws.String(string(tags.AWSRegion)),
		Sdk: &tagsv1.SdkTags{
			Name:    sdkName,
			Version: version,
		},
		Environment: &environment,
	}
}

func printServerlessTelemetryLogLine(payload *instrumentationv1.TracePayload) {
	bytes, err := proto.Marshal(payload)
	if err != nil {
		log.Debug(fmt.Errorf("proto marshal trace payload: %w", err))
	}
	fmt.Println(tracePayloadPrefix + base64.StdEncoding.EncodeToString(bytes))
}

func generateID(size int) ([]byte, error) {
	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return nil, fmt.Errorf("rand read: %w", err)
	}
	dst := make([]byte, hex.EncodedLen(size))
	hex.Encode(dst, b)
	return dst, nil
}

func generateSpanID() ([]byte, error) {
	return generateID(spanIDBytesLength)
}

func generateTraceID() ([]byte, error) {
	return generateID(traceIDBytesLength)
}

func generateEventID() ([]byte, error) {
	return generateID(eventIDBytesLength)
}
