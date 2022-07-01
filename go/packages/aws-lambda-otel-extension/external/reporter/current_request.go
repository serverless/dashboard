package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
	"io/ioutil"

	"go.uber.org/zap"
)

type CurrentRequestData struct {
	LogsQueue         []LogMessage
	UniqueNames       map[string]bool
	EventData         *types.EventDataPayload
	reportAgent       *HttpClient
	lastTelemetryData *[]byte
	logger            *lib.Logger
}

func NewCurrentRequestData(reportAgent *HttpClient) *CurrentRequestData {
	return &CurrentRequestData{
		LogsQueue:   []LogMessage{},
		UniqueNames: map[string]bool{},
		reportAgent: reportAgent,
		logger:      lib.NewLogger(),
	}
}

func (c *CurrentRequestData) postLogs(logs []LogMessage) error {
	messages, err := ReadLogs(logs, c.EventData)
	if err != nil {
		return err
	}

	b, err := json.Marshal(messages)
	if err != nil {
		return err
	}

	c.reportAgent.PostLogs(b)

	return nil
}

func (c *CurrentRequestData) postLog(log LogMessage) error {
	return c.postLogs([]LogMessage{log})
}

func (c *CurrentRequestData) postQueue() {
	c.postLogs(c.LogsQueue)
}

func (c *CurrentRequestData) SendLogs(logs []LogMessage) {
	if c.EventData != nil {
		c.postLogs(logs)
	} else {
		for _, log := range logs {
			c.LogsQueue = append(c.LogsQueue, log)
		}
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
		c.LogsQueue = []LogMessage{}
		c.EventData = nil
	}
	c.UniqueNames[name] = true
}

func (c *CurrentRequestData) GetLastTelemetryData() (*map[string]interface{}, error) {
	if c.lastTelemetryData == nil {
		return nil, nil
	}
	var data map[string]interface{}
	err := json.Unmarshal(*c.lastTelemetryData, &data)
	if err != nil {
		return nil, err
	}
	return &data, nil
}

func (c *CurrentRequestData) SetLastTelemetryData(data *map[string]interface{}) {
	b, err := json.Marshal(data)
	if err != nil {
		return
	}
	c.lastTelemetryData = &b
}

func (c *CurrentRequestData) SaveLastTelemetryData() {
	file, err := ioutil.TempFile("", "sls-otel-extension-storage")
	if err != nil {
		c.logger.Error("Error creating temporary file", zap.Error(err))
		return
	}
	defer file.Close()
	file.Write(*c.lastTelemetryData)
}

func (c *CurrentRequestData) LoadLastTelemetryData() {
	file, _ := ioutil.TempFile("", "sls-otel-extension-storage")
	defer file.Close()
	var b []byte
	_, err := file.Read(b)
	if err != nil {
		c.lastTelemetryData = &b
	}
}
