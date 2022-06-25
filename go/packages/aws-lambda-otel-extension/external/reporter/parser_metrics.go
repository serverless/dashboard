package reporter

import (
	"aws-lambda-otel-extension/external/protoc"
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
	"math"
)

func ParseInternalPayload(data []byte) (*types.RecordPayload, error) {
	var payload *types.RecordPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}
	return payload, nil
}

func ParseEventDataPayload(data json.RawMessage) (*types.EventDataPayload, error) {
	var payload *types.EventDataPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}
	return payload, nil
}

func ParseTelemetryDataPayload(data json.RawMessage) (*types.TelemetryDataPayload, error) {
	var payload *types.TelemetryDataPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}
	return payload, nil
}

func createMetricAttributes(fun map[string]interface{}, record *types.LogPlatformRecord) []*protoc.KeyValue {
	var attributes []*protoc.KeyValue

	// for loop to iterate MeasureAttributes
	for _, ra := range MeasureAttributes {
		if ra.value != "" {
			attributes = append(attributes, &protoc.KeyValue{
				Key:   ra.key,
				Value: getAnyValue(ra.value),
			})
		} else {
			if ra.source != "" {
				if val, ok := fun[ra.source]; ok {
					attributes = append(attributes, &protoc.KeyValue{
						Key:   ra.key,
						Value: getAnyValue(val),
					})
				}
			}
		}
	}

	attributes = append(attributes, &protoc.KeyValue{
		Key:   "faas.error",
		Value: getAnyValue(fun["error"]),
	})

	if record != nil {
		attributes = append(attributes, &protoc.KeyValue{
			Key:   "faas.duration",
			Value: getAnyValue(record.Metrics.DurationMs),
		})
		attributes = append(attributes, &protoc.KeyValue{
			Key:   "faas.billed_duration",
			Value: getAnyValue(record.Metrics.BilledDurationMs),
		})
		attributes = append(attributes, &protoc.KeyValue{
			Key:   "faas.max_memory_used_mb",
			Value: getAnyValue(record.Metrics.MaxMemoryUsedMB),
		})
	}

	// Add timeout info
	hasErrorTimeout := false
	et, ok := fun["errorTimeout"].(string)
	if ok {
		hasErrorTimeout = et == "timeout"
	}

	attributes = append(attributes, &protoc.KeyValue{
		Key:   "faas.error_timeout",
		Value: getAnyValue(hasErrorTimeout),
	})

	return attributes
}

func createResourceAttributes(fun map[string]interface{}) []*protoc.KeyValue {
	var attributes []*protoc.KeyValue

	// for loop to iterate ResourceAttributes
	for _, ra := range ResourceAttributes {
		if ra.value != "" {
			attributes = append(attributes, &protoc.KeyValue{
				Key:   ra.key,
				Value: getAnyValue(ra.value),
			})
		} else {
			if ra.source != "" {
				if val, ok := fun[ra.source]; ok {
					attributes = append(attributes, &protoc.KeyValue{
						Key:   ra.key,
						Value: getAnyValue(val),
					})
				}
			}
		}
	}

	return attributes
}

func createHistogramMetric(count uint64, sum float64, record map[string]interface{}, attributes []*protoc.KeyValue) *protoc.Metric_Histogram {
	return &protoc.Metric_Histogram{
		Histogram: &protoc.Histogram{
			DataPoints: []*protoc.HistogramDataPoint{
				{
					// StartTimeUnixNano: ,
					// TimeUnixNano: ,
					Count:          count,
					Sum:            sum,
					BucketCounts:   []uint64{1, 0},
					ExplicitBounds: []float64{math.Inf(1)},
					Attributes:     attributes,
				},
			},
		},
	}
}

func createCountMetric(count uint64, asInt int64, record map[string]interface{}, attributes []*protoc.KeyValue) *protoc.Metric_Sum {
	return &protoc.Metric_Sum{
		Sum: &protoc.Sum{
			DataPoints: []*protoc.NumberDataPoint{
				{
					// StartTimeUnixNano: ,
					// TimeUnixNano: ,
					Attributes: attributes,
					Value:      &protoc.NumberDataPoint_AsInt{asInt},
				},
			},
		},
	}
}

func CreateMetricsPayload(requestId string, fun map[string]interface{}, record *types.LogPlatformRecord) *protoc.MetricsData {

	metricAttributes := createMetricAttributes(fun, record)

	metricAttributes = append(metricAttributes, &protoc.KeyValue{
		Key:   "faas.execution",
		Value: getAnyValue(requestId),
	})

	if v, ok := fun["httpStatusCode"]; ok {
		metricAttributes = append(metricAttributes, &protoc.KeyValue{
			Key:   "http.status_code",
			Value: getAnyValue(v),
		})
	}

	if v, ok := fun["httpPath"]; ok {
		metricAttributes = append(metricAttributes, &protoc.KeyValue{
			Key:   "http.path",
			Value: getAnyValue(v),
		})
	}

	metrics := []*protoc.Metric{}

	if record == nil {
		metrics = append(metrics, &protoc.Metric{
			Name: "faas.invoke",
			Unit: "1",
			Data: createCountMetric(1, 1, fun, metricAttributes),
		})

	} else {
		// TODO: use real reports
		metrics = append(metrics, &protoc.Metric{
			Name: "faas.duration",
			Unit: "1",
			Data: createHistogramMetric(1, record.Metrics.DurationMs, fun, metricAttributes),
		})

		memory := (float64(record.Metrics.MaxMemoryUsedMB) / float64(record.Metrics.MemorySizeMB)) * 100

		metrics = append(metrics, &protoc.Metric{
			Name: "faas.memory",
			Unit: "1",
			Data: createHistogramMetric(1, memory, fun, metricAttributes),
		})

		if record.Metrics.InitDurationMs > 0 {
			metrics = append(metrics, &protoc.Metric{
				Name: "faas.coldstart_duration",
				Unit: "1",
				Data: createHistogramMetric(1, record.Metrics.InitDurationMs, fun, metricAttributes),
			})
		}
	}

	return &protoc.MetricsData{
		ResourceMetrics: []*protoc.ResourceMetrics{
			{
				Resource: &protoc.Resource{
					Attributes: createResourceAttributes(fun),
				},
				InstrumentationLibraryMetrics: []*protoc.InstrumentationLibraryMetrics{
					{
						InstrumentationLibrary: &protoc.InstrumentationLibrary{
							Name:    "serverless-meter",
							Version: "1.0.0",
						},
						Metrics: metrics,
					},
				},
			},
		},
	}
}
