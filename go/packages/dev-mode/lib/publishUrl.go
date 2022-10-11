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
