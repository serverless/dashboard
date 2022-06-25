package types

// type Attributes struct {
// 	HttpStatusCode       *int64  `json:"http.status_code"`
// 	HttpUrl              *string `json:"http.url"`
// 	FaasId               *string `json:"faas.id"`
// 	FaasName             *string `json:"faas.name"`
// 	FaasCollectorVersion *string `json:"faas.collector_version"`
// 	SLSAppUid            *string `json:"sls.app_uid"`
// 	DeploymentEnv        *string `json:"deployment.environment"`
// 	ServiceName          *string `json:"service.name"`
// 	ServiceNamespace     *string `json:"service.namespace"`
// 	ServiceVersion       *string `json:"service.version"`
// 	CloudRegion          *string `json:"cloud.region"`
// 	CloudProvider        *string `json:"cloud.provider"`
// 	CloudAccountId       *string `json:"cloud.account.id"`
// 	CloudPlatform        *string `json:"cloud.platform"`
// }

type LogJson struct {
	Timestamp         *int64                 `json:"timestamp"`
	Attributes        map[string]interface{} `json:"attributes"`
	Resource          map[string]interface{} `json:"resource"`
	TraceId           *string                `json:"traceId"`
	SpanId            *string                `json:"spanId"`
	SeverityText      *string                `json:"severityText"`
	SeverityNumber    *int64                 `json:"severityNumber"`
	ProcessingOrderId *string                `json:"processingOrderId"`
	Body              *string                `json:"body"`
}

// EventType represents the type of logs in Lambda
type LogEventType string

const (
	// Platform is to receive logs emitted by the platform
	LogPlatform LogEventType = "platform"
	// Function is to receive logs emitted by the function
	LogFunction LogEventType = "function"
	// Extension is to receive logs emitted by the extension
	LogExtension LogEventType = "extension"
)

type SubEventType string

/*
if metrics, ok := objectRecord["metrics"].(map[string]interface{}); ok {
if v, ok := metrics["durationMs"].(float64); ok {
	l.objectRecord.reportLogItem.durationMs = v
}
if v, ok := metrics["billedDurationMs"].(float64); ok {
	l.objectRecord.reportLogItem.billedDurationMs = int(v)
}
if v, ok := metrics["memorySizeMB"].(float64); ok {
	l.objectRecord.reportLogItem.memorySizeMB = int(v)
}
if v, ok := metrics["maxMemoryUsedMB"].(float64); ok {
	l.objectRecord.reportLogItem.maxMemoryUsedMB = int(v)
}
if v, ok := metrics["initDurationMs"].(float64); ok {
	l.objectRecord.reportLogItem.initDurationMs = v
}
log.Debug(fmt.Sprintf("Enhanced metrics: %+v\n", l.objectRecord.reportLogItem))
}
*/
type LogPlatformRecordMetrics struct {
	DurationMs       float64 `json:"durationMs"`
	BilledDurationMs int     `json:"billedDurationMs"`
	MemorySizeMB     int     `json:"memorySizeMB"`
	MaxMemoryUsedMB  int     `json:"maxMemoryUsedMB"`
	InitDurationMs   float64 `json:"initDurationMs"`
}

type LogPlatformRecord struct {
	RequestID string                   `json:"requestId"`
	Metrics   LogPlatformRecordMetrics `json:"metrics"`
	Version   string                   `json:"version"`
	Status    string                   `json:"status"`
}
