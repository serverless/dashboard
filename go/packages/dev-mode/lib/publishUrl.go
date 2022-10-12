package lib

import (
	"fmt"
	"os"
)

func GetBaseUrl() string {
	// Some regions do not support http API so I am just
	// using the region closest to them in that case
	regionMap := map[string]string{
		"ap-northeast-3": "ap-northeast-2",
		"ap-southeast-3": "ap-southeast-2",
		"me-central-1":   "me-south-1",
		"us-gov-east-1":  "us-east-1",
		"us-gov-west-1":  "us-west-1",
	}

	region := os.Getenv("AWS_REGION")
	if fallbackRegion, hasFallback := regionMap[region]; hasFallback {
		region = fallbackRegion
	}

	if _, isDev := os.LookupEnv("SERVERLESS_PLATFORM_STAGE"); isDev {
		return fmt.Sprintf("https://%s.core.serverless-dev.com/extension/api/ingest", region)
	}
	return fmt.Sprintf("https://%s.core.serverless.com/extension/api/ingest", region)
}
