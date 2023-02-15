package environment

import (
	"errors"
	"fmt"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"os"
	"runtime"
)

const (
	ArchitectureARM   Architecture = "arm64"
	ArchitectureAMD64 Architecture = "x86_64"

	OrganizationIDEnvVarName = "SLS_ORG_ID"
	awsRegionEnvVarName      = "AWS_REGION"
)

type (
	// Architecture is the running program's architecture target. Supported values are "arm" and "amd64".
	Architecture string
	// LogGroupName is the name of the Amazon CloudWatch Logs group for the function.
	LogGroupName string
	// LogStreamName is the name of the Amazon CloudWatch Logs stream for the function.
	LogStreamName string
	// MemorySize is the amount of memory available to the function in MB.
	MemorySize int
	// FunctionName is the name of the function.
	FunctionName string
	// FunctionVersion is the version of the function being executed. It may be a number or "$LATEST" string.
	FunctionVersion string
	// OrganizationID is the ID of organization that will be associated with telemetry data sent.
	OrganizationID string
	// AWSRegion is the AWS Region where the Lambda function is executed.
	AWSRegion string
)

type Tags struct {
	Architecture    Architecture
	LogGroupName    LogGroupName
	LogStreamName   LogStreamName
	MemorySize      MemorySize
	FunctionName    FunctionName
	FunctionVersion FunctionVersion
	OrganizationID  OrganizationID
	AWSRegion       AWSRegion
}

func GetTags() (Tags, error) {
	orgID := organizationID()
	if orgID == "" {
		return Tags{}, errors.New("organization ID is empty")
	}
	return Tags{
		Architecture:    architecture(),
		LogGroupName:    logGroupName(),
		LogStreamName:   logStreamName(),
		MemorySize:      memorySize(),
		FunctionName:    functionName(),
		FunctionVersion: functionVersion(),
		AWSRegion:       awsRegion(),
		OrganizationID:  orgID,
	}, nil
}

// organizationID returns the ID of organization that will be associated with telemetry data sent.
func organizationID() OrganizationID {
	return OrganizationID(os.Getenv(OrganizationIDEnvVarName))
}

// architecture returns the running program's architecture target from the runtime environment.
func architecture() Architecture {
	arch, err := newArchitecture(runtime.GOARCH)
	if err != nil {
		fmt.Println(fmt.Errorf("new architecture: %w", err))
		return ""
	}
	return arch
}

// logGroupName returns the name of the Amazon CloudWatch Logs group for the function from the runtime environment.
func logGroupName() LogGroupName {
	return LogGroupName(lambdacontext.LogGroupName)
}

// logStreamName returns the name of the Amazon CloudWatch Logs stream for the function from the runtime environment.
func logStreamName() LogStreamName {
	return LogStreamName(lambdacontext.LogStreamName)
}

// memorySize returns the amount of memory available to the function in MB from the runtime environment.
func memorySize() MemorySize {
	return newMemorySize(lambdacontext.MemoryLimitInMB)
}

// functionName returns the name of the function from the runtime environment.
func functionName() FunctionName {
	return FunctionName(lambdacontext.FunctionName)
}

// functionVersion returns the version of the function being executed.
func functionVersion() FunctionVersion {
	return FunctionVersion(lambdacontext.FunctionVersion)
}

// awsRegion returns the AWS Region where the Lambda function is executed.
func awsRegion() AWSRegion {
	return AWSRegion(os.Getenv(awsRegionEnvVarName))
}

func newArchitecture(s string) (Architecture, error) {
	var architectures = map[string]Architecture{
		"arm":   ArchitectureARM,
		"amd64": ArchitectureAMD64,
	}
	mappedArchitecture, ok := architectures[s]
	if !ok {
		return "", fmt.Errorf("architecture %s not supported", s)
	}
	return mappedArchitecture, nil
}

func newMemorySize(size int) MemorySize {
	if size <= 0 {
		fmt.Println(errors.New("memory size cannot be less or equal 0"))
	}
	return MemorySize(size)
}
