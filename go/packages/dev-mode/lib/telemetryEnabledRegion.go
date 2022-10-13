package lib

import (
	"os"
)

func contains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}

	return false
}

func IsTelemetryEnabledRegion() bool {
	region := os.Getenv("AWS_REGION")
	telemetryEnabledRegions := []string{"us-east-1"}

	return contains(telemetryEnabledRegions, region)
}
