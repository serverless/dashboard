package metrics

import (
	"aws-lambda-otel-extension/external/protoc"
	"aws-lambda-otel-extension/external/types"
	"encoding/json"
	"math"
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

func parseTelemetryDataPayload(data json.RawMessage) (*types.TelemetryDataPayload, error) {
	var payload *types.TelemetryDataPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}
	return payload, nil
}

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

func createMetricAttributes(fun map[string]interface{}, report bool) []*protoc.KeyValue {
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

	if report {
		//TODO: use real report
		/*
		   {
		     key: 'faas.duration',
		     value: {
		       doubleValue: report.record.metrics.durationMs,
		     },
		   },
		   {
		     key: 'faas.billed_duration',
		     value: {
		       intValue: report.record.metrics.billedDurationMs,
		     },
		   },
		   {
		     key: 'faas.max_memory_used_mb',
		     value: {
		       intValue: report.record.metrics.maxMemoryUsedMB,
		     },
		   }
		*/
		attributes = append(attributes, &protoc.KeyValue{
			Key:   "faas.duration",
			Value: getAnyValue(fun["duration"]),
		})
		attributes = append(attributes, &protoc.KeyValue{
			Key:   "faas.billed_duration",
			Value: getAnyValue(fun["billedDuration"]),
		})
		attributes = append(attributes, &protoc.KeyValue{
			Key:   "faas.max_memory_used_mb",
			Value: getAnyValue(fun["maxMemoryUsedMB"]),
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

	histogram := &protoc.Metric_Histogram{

		Histogram: &protoc.Histogram{
			DataPoints: []*protoc.HistogramDataPoint{
				{
					Count: count,
					Sum:   sum,
					// StartTimeUnixNano: ,
					BucketCounts:   []uint64{1, 0},
					ExplicitBounds: []float64{math.Inf(1)},
					Attributes:     attributes,
				},
			},
		},
	}
	return histogram

}

func createMetricsPayload(requestId string, fun map[string]interface{}, report bool) *protoc.MetricsData {

	metricAttributes := createMetricAttributes(fun, report)

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

	if report {

	} else {
		metrics = append(metrics, &protoc.Metric{
			Name: "faas.duration",
			Unit: "1",
			Data: createHistogramMetric(1, 1, fun, metricAttributes),
		})
	}

	metricsData := &protoc.MetricsData{
		ResourceMetrics: []*protoc.ResourceMetrics{
			{
				Resource: &protoc.Resource{
					Attributes: createResourceAttributes(fun),
				},
				InstrumentationLibraryMetrics: []*protoc.InstrumentationLibraryMetrics{
					{
						InstrumentationLibrary: &protoc.InstrumentationLibrary{
							Name: "serverless-meter",
						},
						Metrics: metrics,
					},
				},
			},
		},
	}

	return metricsData

}
