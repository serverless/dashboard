package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"encoding/json"
	"testing"
	"time"
)

func TestReporterClient_Flush(t *testing.T) {
	var userSettings lib.UserSettings
	json.Unmarshal([]byte(`{"logs": {"destination": "/logs"}, "request": {"destination": "/request-response"}, "metrics": {"destination": "/metrics"}, "common": {"destination": {"requestHeaders": "serverless_token=53c94d82-a653-40de-94c5-c877a8c0f2e5"}}, "traces": {"destination": "/traces"}, "response": {"destination": "/request-response"}}`), &userSettings)

	tests := []struct {
		name string
	}{
		{
			name: "TestReporterClient_Flush",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			c := NewReporterClient(&userSettings)

			// empty flush
			c.Flush()

			// flush with data
			c.pool.Put(PostData{
				path:       "",
				body:       []byte("test"),
				isProtobuf: false,
				retries:    0,
			})

			c.Flush()
			c.WaitRequests(time.Millisecond * 10)
			// if err != nil {
			// 	t.Error(err)
			// }

		})
	}
}
