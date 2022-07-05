package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
	"os"
	"path/filepath"

	"go.uber.org/zap"
)

type CurrentRequestData struct {
	LogsQueue         []LogMessage
	UniqueNames       map[string]bool
	EventData         *types.EventDataPayload
	reportAgent       *ReporterClient
	lastTelemetryData *map[string]interface{}
	logger            *lib.Logger
}

func NewCurrentRequestData(reportAgent *ReporterClient) *CurrentRequestData {
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

func (c *CurrentRequestData) GetLastTelemetryData() *map[string]interface{} {
	return c.lastTelemetryData
}

func (c *CurrentRequestData) SetLastTelemetryData(data map[string]interface{}) {
	c.lastTelemetryData = &data
}

func getTempFilename() string {
	return filepath.Join(os.TempDir(), "sls-otel-extension-storage")
}

func (c *CurrentRequestData) SaveLastTelemetryData() {
	file, err := os.Open(getTempFilename())
	if err != nil {
		c.logger.Error("Error creating temporary file", zap.Error(err))
		return
	}
	defer file.Close()
	b, err := json.Marshal(c.lastTelemetryData)
	if err != nil {
		return
	}
	file.Write(b)
}

func (c *CurrentRequestData) LoadLastTelemetryData() {
	tempFile := getTempFilename()
	b, err := os.ReadFile(tempFile)
	if err != nil {
		return
	}
	var data map[string]interface{}
	err = json.Unmarshal(b, &data)
	if err != nil {
		return
	}
	c.lastTelemetryData = &data
	os.Remove(tempFile)
}
