package reporter

import (
	"aws-lambda-otel-extension/external/lib"
	"aws-lambda-otel-extension/external/protoc"
	"fmt"
)

type AttributeHelper struct {
	key    string
	value  string
	source string
}

var ResourceAttributes []AttributeHelper = []AttributeHelper{
	{
		key:    "faas.id",
		source: "computeCustomArn",
	},
	{
		key:    "faas.name",
		source: "functionName",
	},
	{
		key:    "cloud.region",
		source: "computeRegion",
	},
	{
		key:    "sls.application_name",
		source: "sls_app_name",
	},
	{
		key:    "sls.app_uid",
		source: "sls_app_id",
	},
	{
		key:    "service.namespace",
		source: "sls_service_name",
	},
	{
		key:    "deployment.environment",
		source: "sls_stage",
	},
	{
		key:    "sls.org_uid",
		source: "sls_org_id",
	},
	{
		key:    "service.name",
		source: "functionName",
	},
	{
		key:    "telemetry.sdk.language",
		source: "computeRuntime",
	},
	{
		key:    "telemetry.sdk.name",
		value:  "opentelemetry",
		source: "opentelemetry",
	},
	{
		key:    "telemetry.sdk.version",
		value:  "1.0.1",
		source: "version",
	},
	{
		key:    "cloud.provider",
		value:  "aws",
		source: "provider",
	},
	{
		key:    "faas.version",
		source: "computeCustomFunctionVersion",
	},
	{
		key:    "sls.deployment_uid",
		source: "sls_deploy_id",
	},
	{
		key:    "cloud.account.id",
		source: "eventCustomAccountId",
	},
	{
		key:    "cloud.platform",
		value:  "lambda",
		source: "opentelemetry",
	},
	{
		key:    "faas.max_memory",
		source: "computeMemorySize",
	},
	{
		key:    "faas.log_group",
		source: "computeCustomLogGroupName",
	},
	{
		key:    "faas.log_stream_name",
		source: "computeCustomLogStreamName",
	},
	{
		key:    "faas.collector_version",
		value:  fmt.Sprintf("@serverless/aws-lambda-otel-extension@%s", lib.Version),
		source: fmt.Sprintf("@serverless/aws-lambda-otel-extension@%s", lib.Version),
	},
}

var MeasureAttributes []AttributeHelper = []AttributeHelper{
	{
		key:    "faas.coldstart",
		source: "computeIsColdStart",
	},
	{
		key:    "http.method",
		source: "eventCustomHttpMethod",
	},
	{
		key:    "http.raw_path",
		source: "rawHttpPath",
	},
	{
		key:    "http.domain",
		source: "eventCustomDomain",
	},
	{
		key:    "faas.error_stacktrace",
		source: "errorStacktrace",
	},
	{
		key:    "faas.error_message",
		source: "errorMessage",
	},
	{
		key:    "aws.xray.trace_id",
		source: "eventCustomXTraceId",
	},
	{
		key:    "faas.event_type",
		source: "eventType",
	},
	{
		key:    "faas.arch",
		source: "computeCustomEnvArch",
	},
	{
		key:    "faas.api_gateway_request_id",
		source: "eventCustomRequestId",
	},
	{
		key:    "faas.error_timeout",
		source: "timeout",
	},
	{
		key:    "faas.event_source",
		source: "eventSource",
	},
	{
		key:    "faas.api_gateway_app_id",
		source: "eventCustomApiId",
	},
	{
		key:    "faas.request_time_epoch",
		source: "eventCustomRequestTimeEpoch",
	},
	{
		key:    "faas.error_culprit",
		source: "errorCulprit",
	},
	{
		key:    "faas.error_type",
		source: "errorType",
	},
}

// Logs helpers
var LogsMetricAttributeNames map[string]bool = map[string]bool{
	"faas.arch":                   true,
	"faas.api_gateway_request_id": true,
	"faas.event_source":           true,
	"faas.api_gateway_app_id":     true,
}

var LogsResourceAttributeNames map[string]bool = map[string]bool{
	"faas.id":                true,
	"faas.name":              true,
	"cloud.region":           true,
	"sls.app_uid":            true,
	"service.namespace":      true,
	"deployment.environment": true,
	"service.name":           true,
	"telemetry.sdk.language": true,
	"telemetry.sdk.name":     true,
	"telemetry.sdk.version":  true,
	"cloud.provider":         true,
	"cloud.account.id":       true,
	"cloud.platform":         true,
	"faas.collector_version": true,
}

var LogsSeverityNumber map[string]int = map[string]int{
	"TRACE": 1,
	"DEBUG": 5,
	"INFO":  9,
	"WARN":  13,
	"ERROR": 17,
	"FATAL": 21,
}

// Protobuf helpers

func getAnyValue(value interface{}) *protoc.AnyValue {
	switch value.(type) {
	case string:
		return &protoc.AnyValue{
			Value: &protoc.AnyValue_StringValue{
				StringValue: value.(string),
			},
		}
	case int64:
	case int32:
	case int:
		return &protoc.AnyValue{
			Value: &protoc.AnyValue_IntValue{
				IntValue: value.(int64),
			},
		}
	case bool:
		return &protoc.AnyValue{
			Value: &protoc.AnyValue_BoolValue{
				BoolValue: value.(bool),
			},
		}
	}
	return nil
}

func getJsonValue(pv *protoc.AnyValue) interface{} {
	if pv == nil {
		return nil
	}
	switch pv.Value.(type) {
	case *protoc.AnyValue_StringValue:
		return pv.GetStringValue()
	case *protoc.AnyValue_IntValue:
		return pv.GetIntValue()
	case *protoc.AnyValue_BoolValue:
		return pv.GetBoolValue()
	}
	return nil
}
