package metrics

import (
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
)

func parseInternalPayload(data []byte) (*types.RecordPayload, error) {
	var payload *types.RecordPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}
	return payload, nil
}

func parseEventDataPayload(data json.RawMessage) (*types.EventDataPayload, error) {
	var payload *types.EventDataPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}
	return payload, nil
}
