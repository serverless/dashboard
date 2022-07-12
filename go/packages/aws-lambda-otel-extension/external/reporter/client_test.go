package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"encoding/json"
	"testing"
	"time"
)

func TestReporterClient_Flush(t *testing.T) {
	var settings lib.ExtensionSettings
	json.Unmarshal([]byte{}, &settings)

	tests := []struct {
		name string
	}{
		{
			name: "TestReporterClient_Flush",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			c := NewReporterClient(&settings)

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
