package reporter

import (
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
)

type CurrentRequestData struct {
	LogsQueue   [][]byte
	UniqueNames map[string]bool
	EventData   *types.EventDataPayload
	reportAgent *HttpClient
}

func NewCurrentRequestData(reportAgent *HttpClient) *CurrentRequestData {
	return &CurrentRequestData{
		LogsQueue:   [][]byte{},
		UniqueNames: map[string]bool{},
		reportAgent: reportAgent,
	}
}

func (c *CurrentRequestData) postLog(log []byte) {
	c.reportAgent.PostLogs(func() ([]byte, error) {
		var b []byte
		messages, err := readLogs(log, c.EventData)
		if err != nil {
			return b, err
		}
		return json.Marshal(messages)
	})
}

func (c *CurrentRequestData) postQueue() {
	for _, log := range c.LogsQueue {
		c.postLog(log)
	}
}

func (c *CurrentRequestData) SendLog(log []byte) {
	if c.EventData != nil {
		c.postLog(log)
	} else {
		c.LogsQueue = append(c.LogsQueue, log)
	}
}

func (c *CurrentRequestData) SetEventData(eventData *types.EventDataPayload) {
	c.EventData = eventData
	if len(c.LogsQueue) > 0 {
		c.postQueue()
	}
}

func (c *CurrentRequestData) Flush() {
	c.postQueue()
}

func (c *CurrentRequestData) SetUniqueName(name string) {
	if c.UniqueNames[name] {
		c.LogsQueue = [][]byte{}
		c.EventData = nil
	}
	c.UniqueNames[name] = true
}
