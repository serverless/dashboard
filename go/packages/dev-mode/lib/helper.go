package lib

import (
	"os"
	"strings"
)

func HasInternalExtension() bool {
	wrapper := os.Getenv("AWS_LAMBDA_EXEC_WRAPPER")
	return strings.HasPrefix(wrapper, "/opt/sls-sdk")
}

func InternalExtensionRuntime() string {
	wrapper := os.Getenv("AWS_LAMBDA_EXEC_WRAPPER")
	if strings.HasPrefix(wrapper, "/opt/sls-sdk-node") {
		return "node"
	} else if strings.HasPrefix(wrapper, "/opt/sls-sdk-python") {
		return "python"
	}
	return "unknown"
}
