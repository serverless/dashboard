package slslambda

import (
	"errors"
	"fmt"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"os"
	"runtime"
)

const (
	architectureARM   architecture = "arm64"
	architectureAMD64 architecture = "x86_64"

	organizationIDEnvVarName = "SLS_ORG_ID"
	awsRegionEnvVarName      = "AWS_REGION"
)

type (
	// architecture is the running program's architecture target. Supported values are "arm" and "amd64".
	architecture string
	// logGroupName is the name of the Amazon CloudWatch Logs group for the function.
	logGroupName string
	// logStreamName is the name of the Amazon CloudWatch Logs stream for the function.
	logStreamName string
	// memorySize is the amount of memory available to the function in MB.
	memorySize int
	// functionName is the name of the function.
	functionName string
	// functionVersion is the version of the function being executed. It may be a number or "$LATEST" string.
	functionVersion string
	// organizationID is the ID of organization that will be associated with telemetry data sent.
	organizationID string
	// awsRegion is the AWS Region where the Lambda function is executed.
	awsRegion string
)

type tags struct {
	Architecture    architecture
	LogGroupName    logGroupName
	LogStreamName   logStreamName
	MemorySize      memorySize
	FunctionName    functionName
	FunctionVersion functionVersion
	OrganizationID  organizationID
	AWSRegion       awsRegion
}

func getTags() (tags, error) {
	orgID := getOrganizationID()
	if orgID == "" {
		return tags{}, errors.New("organization ID is empty")
	}
	return tags{
		Architecture:    getArchitecture(),
		LogGroupName:    getLogGroupName(),
		LogStreamName:   getLogStreamName(),
		MemorySize:      getMemorySize(),
		FunctionName:    getFunctionName(),
		FunctionVersion: getFunctionVersion(),
		AWSRegion:       getAwsRegion(),
		OrganizationID:  orgID,
	}, nil
}

// getOrganizationID returns the ID of organization that will be associated with telemetry data sent.
func getOrganizationID() organizationID {
	return organizationID(os.Getenv(organizationIDEnvVarName))
}

// architecture returns the running program's architecture target from the runtime environment.
func getArchitecture() architecture {
	arch, err := newArchitecture(runtime.GOARCH)
	if err != nil {
		debugLog("new architecture:", err)
		return ""
	}
	return arch
}

// getLogGroupName returns the name of the Amazon CloudWatch Logs group for the function from the runtime environment.
func getLogGroupName() logGroupName {
	return logGroupName(lambdacontext.LogGroupName)
}

// getLogStreamName returns the name of the Amazon CloudWatch Logs stream for the function from the runtime environment.
func getLogStreamName() logStreamName {
	return logStreamName(lambdacontext.LogStreamName)
}

// getMemorySize returns the amount of memory available to the function in MB from the runtime environment.
func getMemorySize() memorySize {
	return newMemorySize(lambdacontext.MemoryLimitInMB)
}

// getFunctionName returns the name of the function from the runtime environment.
func getFunctionName() functionName {
	return functionName(lambdacontext.FunctionName)
}

// getFunctionVersion returns the version of the function being executed.
func getFunctionVersion() functionVersion {
	return functionVersion(lambdacontext.FunctionVersion)
}

// getAwsRegion returns the AWS Region where the Lambda function is executed.
func getAwsRegion() awsRegion {
	return awsRegion(os.Getenv(awsRegionEnvVarName))
}

func newArchitecture(s string) (architecture, error) {
	var architectures = map[string]architecture{
		"arm64": architectureARM,
		"amd64": architectureAMD64,
	}
	mappedArchitecture, ok := architectures[s]
	if !ok {
		return "", fmt.Errorf("architecture %s not supported", s)
	}
	return mappedArchitecture, nil
}

func newMemorySize(size int) memorySize {
	if size <= 0 {
		debugLog("memory size cannot be less or equal 0")
	}
	return memorySize(size)
}
