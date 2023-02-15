package environment

import (
	"errors"
	"fmt"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"os"
	"runtime"
	"strconv"
)

const (
	ArchitectureARM   Architecture = "arm"
	ArchitectureAMD64 Architecture = "amd64"

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
	// FunctionVersion is the version of the function being executed.
	FunctionVersion int
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

func GetTags() Tags {
	return Tags{
		Architecture:    architecture(),
		LogGroupName:    logGroupName(),
		LogStreamName:   logStreamName(),
		MemorySize:      memorySize(),
		FunctionName:    functionName(),
		FunctionVersion: functionVersion(),
		AWSRegion:       awsRegion(),
	}
}

// GetOrganizationID returns the ID of organization that will be associated with telemetry data sent.
func GetOrganizationID() OrganizationID {
	orgID := os.Getenv(OrganizationIDEnvVarName)
	if orgID == "" {

	}
	return OrganizationID(orgID)
}

// architecture returns the running program's architecture target from the runtime environment.
func architecture() Architecture {
	arch, err := newArchitecture(runtime.GOARCH)
	if err != nil {
		fmt.Print(fmt.Errorf("new architecture: %w", err))
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
	return newFunctionVersion(lambdacontext.FunctionVersion)
}

// GetOrganizationID returns the ID of organization that will be associated with telemetry data sent.
func awsRegion() AWSRegion {
	return AWSRegion(os.Getenv(awsRegionEnvVarName))
}

func newArchitecture(s string) (Architecture, error) {
	var architectures = map[string]Architecture{
		string(ArchitectureARM):   ArchitectureARM,
		string(ArchitectureAMD64): ArchitectureAMD64,
	}
	mappedArchitecture, ok := architectures[s]
	if !ok {
		return "", fmt.Errorf("architecture %s not supported", s)
	}
	return mappedArchitecture, nil
}

func newMemorySize(size int) MemorySize {
	if size <= 0 {
		fmt.Print(errors.New("memory size cannot be less or equal 0"))
	}
	return MemorySize(size)
}

func newFunctionVersion(s string) FunctionVersion {
	version, err := strconv.Atoi(s)
	if err != nil {
		fmt.Print(fmt.Errorf("parse funcion version as int: %w", err))
		return 0
	}
	if version <= 0 {
		fmt.Print(errors.New("function version cannot be less than 0"))
	}
	return FunctionVersion(version)
}
