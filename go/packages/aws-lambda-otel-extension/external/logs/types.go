package logs

type Attributes struct {
	HttpStatusCode       *int64  `json:"http.status_code"`
	HttpUrl              *string `json:"http.url"`
	FaasId               *string `json:"faas.id"`
	FaasName             *string `json:"faas.name"`
	FaasCollectorVersion *string `json:"faas.collector_version"`
	SLSAppUid            *string `json:"sls.app_uid"`
	DeploymentEnv        *string `json:"deployment.environment"`
	ServiceName          *string `json:"service.name"`
	ServiceNamespace     *string `json:"service.namespace"`
	ServiceVersion       *string `json:"service.version"`
	CloudRegion          *string `json:"cloud.region"`
	CloudProvider        *string `json:"cloud.provider"`
	CloudAccountId       *string `json:"cloud.account.id"`
	CloudPlatform        *string `json:"cloud.platform"`
}

type LogJson struct {
	Timestamp         *int64     `json:"timestamp"`
	Attributes        Attributes `json:"attributes"`
	TraceId           *string    `json:"traceId"`
	SpanId            *string    `json:"spanId"`
	SeverityText      *string    `json:"severityText"`
	SeverityNumber    *int64     `json:"severityNumber"`
	ProcessingOrderId *string    `json:"processingOrderId"`
	Body              *string    `json:"body"`
}
