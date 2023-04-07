package lib

import (
	"os"
	"strings"
)

func HasInternalExtension() bool {
	wrapper := os.Getenv("AWS_LAMBDA_EXEC_WRAPPER")
	return strings.HasPrefix(wrapper, "/opt/sls-sdk")
}
