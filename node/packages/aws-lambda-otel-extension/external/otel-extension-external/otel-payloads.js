'use strict';

const { resourceAttributes, measureAttributes, stripResponseBlobData } = require('./helper');

const createMetricAttributes = (fun, report) => {
  const metricAttributes = measureAttributes.map(({ key, value, source, type }) => {
    switch (type) {
      case 'intValue': {
        const intValue = value || fun[source] || 0;
        return {
          key,
          value: {
            [type]: intValue,
          },
        };
      }
      case 'boolValue': {
        const boolValue = value || fun[source] || false;
        return {
          key,
          value: {
            [type]: boolValue,
          },
        };
      }
      case 'stringValue':
      default: {
        const recordValue = value || fun[source];
        const finalValue = recordValue === undefined ? null : recordValue;
        return {
          key,
          value: {
            [type]: String(finalValue),
          },
        };
      }
    }
  });

  metricAttributes.push({
    key: 'faas.error',
    value: {
      boolValue: fun.error,
    },
  });
  if (report) {
    metricAttributes.push(
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
    );
  }

  metricAttributes.push({
    key: 'faas.error_timeout',
    value: {
      boolValue: fun.errorCulprit === 'timeout',
    },
  });

  return metricAttributes;
};

const createResourceAttributes = (fun) =>
  resourceAttributes.map(({ key, value, source, type }) => {
    switch (type) {
      case 'intValue': {
        const intValue = value || fun[source] || 0;
        return {
          key,
          value: {
            [type]: intValue,
          },
        };
      }
      case 'boolValue': {
        const boolValue = value || fun[source] || false;
        return {
          key,
          value: {
            [type]: boolValue,
          },
        };
      }
      case 'stringValue':
      default: {
        const recordValue = value || fun[source];
        const finalValue = recordValue === undefined ? null : recordValue;
        return {
          key,
          value: {
            [type]: `${finalValue}`,
          },
        };
      }
    }
  });

const createAttributes = (eventData) => {
  const key = Object.keys(eventData.eventData)[0];

  const metricAttributeNames = new Set([
    'faas.arch',
    'faas.api_gateway_request_id',
    'faas.event_source',
    'faas.api_gateway_app_id',
  ]);
  const metricsAtt = {};
  for (const attribute of createMetricAttributes(eventData.eventData[key])) {
    if (!metricAttributeNames.has(attribute.key)) continue;
    metricsAtt[attribute.key] = Object.values(attribute.value || {})[0];
  }

  const resourceAttributeNames = new Set([
    'faas.id',
    'faas.name',
    'cloud.region',
    'sls.app_uid',
    'service.namespace',
    'deployment.environment',
    'service.name',
    'telemetry.sdk.language',
    'telemetry.sdk.name',
    'telemetry.sdk.version',
    'cloud.provider',
    'cloud.account.id',
    'cloud.platform',
    'faas.collector_version',
  ]);
  const resourceAtt = {};
  for (const attribute of createResourceAttributes(eventData.eventData[key])) {
    if (!resourceAttributeNames.has(attribute.key)) continue;
    resourceAtt[attribute.key] = Object.values(attribute.value || {})[0];
  }

  return {
    resourceAtt,
    metricsAtt,
  };
};

const createLogPayload = (eventData, logs) => {
  const spanData = eventData.span;
  const { resourceAtt, metricsAtt } = createAttributes(eventData);

  const severityNumberMap = {
    TRACE: 1,
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
    FATAL: 21,
  };
  const severityLevelNames = new Set(Object.keys(severityNumberMap));

  return logs.map((log) => {
    const split = (log.record || '').split('\t');
    return {
      Timestamp: new Date(log.time).getTime(),
      Attributes: resourceAtt,
      Resource: metricsAtt,
      TraceId: spanData.traceId,
      SpanId: spanData.spanId,
      SeverityText: severityLevelNames.has(split[2]) ? split[2] : undefined,
      SeverityNumber: severityNumberMap[split[2]],
      Body: log.record || '',
      ProcessingOrderId: process.hrtime.bigint().toString(),
    };
  });
};

const createRequestPayload = (eventData) => {
  const { resourceAtt, metricsAtt } = createAttributes(eventData);
  return {
    ...eventData,
    attributes: resourceAtt,
    resource: metricsAtt,
  };
};

const createResponsePayload = (eventData, currentRequestData) => {
  const { resourceAtt, metricsAtt } = createAttributes(currentRequestData);
  const strippedResponseData = stripResponseBlobData(eventData);
  return {
    ...strippedResponseData,
    timestamp: Date.now(),
    attributes: resourceAtt,
    resource: metricsAtt,
  };
};

const createHistogramMetric = ({ name, unit, count, sum, record, attributes }) => ({
  name,
  unit,
  histogram: {
    dataPoints: [
      {
        startTimeUnixNano: (new Date(record.startTime).getTime() * 1000000).toString(),
        timeUnixNano: (new Date(record.endTime).getTime() * 1000000).toString(),
        count,
        sum,
        bucketCounts: ['1', '0'],
        explicitBounds: ['Infinity'],
        attributes,
      },
    ],
    aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
  },
});

const createCountMetric = ({ name, unit, asInt, record, attributes }) => ({
  name,
  unit,
  sum: {
    dataPoints: [
      {
        startTimeUnixNano: (new Date(record.startTime).getTime() * 1000000).toString(),
        timeUnixNano: (new Date(record.endTime).getTime() * 1000000).toString(),
        asInt,
        attributes,
      },
    ],
    aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
    isMonotonic: true,
  },
});

const batchOverflowSpans = (traces) => {
  const MAX_SPANS = 100;

  const spanList = [];

  const groupedLibrarySpans = traces.resourceSpans[0].instrumentationLibrarySpans.reduce(
    (obj, librarySpans) => {
      const key = `${librarySpans.instrumentationLibrary.name}-${librarySpans.instrumentationLibrary.version}`;
      const { spans, ...rest } = librarySpans;
      obj[key] = { obj: rest, spans };

      return obj;
    },
    {}
  );

  do {
    const spans = Object.keys(groupedLibrarySpans)
      .filter((key) => groupedLibrarySpans[key].spans.length > 0)
      .map((key) => {
        const librarySpan = groupedLibrarySpans[key];
        const chunkedSpans = librarySpan.spans.splice(0, MAX_SPANS);
        return {
          ...librarySpan.obj,
          spans: chunkedSpans,
        };
      });
    const record = {
      resource: traces.resourceSpans[0].resource,
      instrumentationLibrarySpans: spans,
    };
    spanList.push({
      resourceSpans: [record],
    });
  } while (
    Object.keys(groupedLibrarySpans).reduce(
      (sum, key) => groupedLibrarySpans[key].spans.length + sum,
      0
    ) > 0
  );
  return spanList;
};

const createMetricsPayload = (requestId, fun, report = null) => {
  const metricAttributes = createMetricAttributes(fun, report);
  metricAttributes.push({
    key: 'faas.execution',
    value: {
      stringValue: requestId,
    },
  });
  if (fun.httpStatusCode) {
    metricAttributes.push({
      key: 'http.status_code',
      value: {
        intValue: fun.httpStatusCode,
      },
    });
  }
  if (fun.httpPath) {
    metricAttributes.push({
      key: 'http.path',
      value: {
        stringValue: fun.httpPath,
      },
    });
  }

  const metrics = [];

  // We only want to send an invocation once at the same time we send trace data
  // if we have already sent this data then sendRequest.trace will be marked as true
  if (!report) {
    metrics.push(
      createCountMetric({
        name: 'faas.invoke',
        unit: '1',
        asInt: '1',
        record: fun,
        attributes: metricAttributes,
      })
    );
  } else {
    // Reports will be sent separately and we only want to send this data once
    metrics.push(
      createHistogramMetric({
        name: 'faas.duration',
        unit: '1',
        count: '1',
        sum: report.record.metrics.durationMs,
        record: fun,
        attributes: metricAttributes,
      }),
      createHistogramMetric({
        name: 'faas.memory',
        unit: '1',
        count: '1',
        sum: (report.record.metrics.maxMemoryUsedMB / report.record.metrics.memorySizeMB) * 100,
        record: fun,
        attributes: metricAttributes,
      })
    );

    if (report.record.metrics.initDurationMs) {
      metrics.push(
        createHistogramMetric({
          name: 'faas.coldstart_duration',
          unit: '1',
          count: '1',
          sum: report.record.metrics.initDurationMs,
          record: fun,
          attributes: metricAttributes,
        })
      );
    }
  }

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: createResourceAttributes(fun),
        },
        instrumentationLibraryMetrics: [
          {
            instrumentationLibrary: {
              name: 'serverless-meter',
            },
            metrics,
          },
        ],
      },
    ],
  };
};

const createTracePayload = (requestId, fun, traces) => {
  const metricAttributes = createMetricAttributes(fun);

  traces.resourceSpans = [
    {
      resource: {
        attributes: createResourceAttributes(fun),
      },
      instrumentationLibrarySpans: [
        ...(traces.resourceSpans || [])[0].instrumentationLibrarySpans.map((librarySpans) => {
          return {
            ...librarySpans,
            spans: librarySpans.spans.map((span) => {
              const existingKeys = Object.keys(span.attributes);
              return {
                ...span,
                attributes: [
                  ...Object.keys(span.attributes).map((key) => {
                    const jsType = typeof span.attributes[key];

                    let type = 'stringValue';
                    let value = `${span.attributes[key]}`;

                    if (jsType === 'number') {
                      type = 'intValue';
                      value = span.attributes[key];
                    }

                    return {
                      key,
                      value: {
                        [type]: value,
                      },
                    };
                  }),
                  ...metricAttributes.filter(({ key }) => !existingKeys.includes(key)),
                ],
              };
            }),
          };
        }),
      ],
    },
  ];

  return batchOverflowSpans(traces);
};

module.exports = {
  createAttributes,
  createLogPayload,
  createTracePayload,
  createMetricsPayload,
  createRequestPayload,
  createResponsePayload,
};
