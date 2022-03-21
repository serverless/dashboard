'use strict';

const get = require('lodash.get');
const { logMessage } = require('../lib/helper');
const { resourceAttributes, measureAttributes } = require('./helper');

const createMetricAttributes = (fun, report) => {
  const timedOut = get(fun.record, 'errorCulprit') === 'timeout';
  const timeoutObject = [
    {
      key: 'faas.error_timeout',
      value: {
        boolValue: !!timedOut,
      },
    },
  ];

  const metricAttributes = [
    ...measureAttributes.map(({ key, value, source, type }) => {
      switch (type) {
        case 'intValue': {
          const intValue = value || get(fun.record, source, 0);
          return {
            key,
            value: {
              [type]: intValue,
            },
          };
        }
        case 'boolValue': {
          const boolValue = value || get(fun.record, source, false);
          return {
            key,
            value: {
              [type]: boolValue,
            },
          };
        }
        case 'stringValue':
        default: {
          const recordValue = value || get(fun.record, source);
          const finalValue = recordValue === undefined ? null : recordValue;
          return {
            key,
            value: {
              [type]: `${finalValue}`,
            },
          };
        }
      }
    }),
    {
      key: 'faas.error',
      value: {
        boolValue: get(fun, 'record.error'),
      },
    },
    ...(report.record
      ? [
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
          },
        ]
      : []),
    ...timeoutObject,
  ];

  return metricAttributes;
};

const createResourceAttributes = (fun) =>
  resourceAttributes.map(({ key, value, source, type }) => {
    switch (type) {
      case 'intValue': {
        const intValue = value || get(fun.record, source, 0);
        return {
          key,
          value: {
            [type]: intValue,
          },
        };
      }
      case 'boolValue': {
        const boolValue = value || get(fun.record, source, false);
        return {
          key,
          value: {
            [type]: boolValue,
          },
        };
      }
      case 'stringValue':
      default: {
        const recordValue = value || get(fun.record, source);
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

const createLogPayload = (fun, logs) => {
  const spanData = fun.span;
  const key = Object.keys(fun.eventData)[0];
  const metricsAtt = createMetricAttributes({ record: fun.eventData[key] }, {})
    .filter((attr) => {
      return [
        'faas.arch',
        'faas.api_gateway_request_id',
        'faas.event_source',
        'faas.api_gateway_app_id',
      ].includes(attr.key);
    })
    .reduce(
      (obj, attr) => ({
        ...obj,
        [attr.key]: Object.values(attr.value)[0],
      }),
      {}
    );
  const resourceAtt = createResourceAttributes({ record: fun.eventData[key] })
    .filter((attr) => {
      return [
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
      ].includes(attr.key);
    })
    .reduce(
      (obj, attr) => ({
        ...obj,
        [attr.key]: Object.values(attr.value)[0],
      }),
      {}
    );

  const severityNumberMap = {
    TRACE: 1,
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
    FATAL: 21,
  };

  return logs.map((log) => {
    const split = (log.record || '').split('\t');
    return {
      Timestamp: split[0] ? new Date(split[0]).getTime() : new Date().getTime(),
      Attributes: resourceAtt,
      Resource: metricsAtt,
      TraceId: spanData.traceId,
      SpanId: spanData.spanId,
      SeverityText: Object.keys(severityNumberMap).includes(split[2]) ? split[2] : undefined,
      SeverityNumber: severityNumberMap[split[2]],
      Body: log.record || '',
    };
  });
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

const batchOverflowSpans = (overflow) => {
  const MAX_SPANS = 100;

  const spanList = [];

  const groupedLibrarySpans = overflow.resourceSpans[0].instrumentationLibrarySpans.reduce(
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
      resource: overflow.resourceSpans[0].resource,
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

const createMetricsPayload = (groupedByRequestId, sentRequests) =>
  Object.keys(groupedByRequestId).map((requestId) => {
    const sentRequest = sentRequests.find(({ requestId: rId }) => rId === requestId);
    const data = groupedByRequestId[requestId];
    const report = data['platform.report'] || {};
    const fun = data.function || {};

    const path = get(fun.record, 'httpPath');
    const statusCode = get(fun.record, 'httpStatusCode');

    if (!fun.record) {
      logMessage('Metrics fun - ', JSON.stringify(data));
    }

    const metricAttributes = [
      ...createMetricAttributes(fun, report),
      {
        key: 'faas.execution',
        value: {
          stringValue: requestId,
        },
      },
      ...(statusCode
        ? [
            {
              key: 'http.status_code',
              value: {
                intValue: statusCode,
              },
            },
          ]
        : []),
      ...(path
        ? [
            {
              key: 'http.path',
              value: {
                stringValue: `${path}`,
              },
            },
          ]
        : []),
    ];

    const metrics = [];

    // We only want to send an invocation once at the same time we send trace data
    // if we have already sent this data then sendRequest.trace will be marked as true
    if (!sentRequest || !sentRequest.trace) {
      metrics.push(
        createCountMetric({
          name: 'faas.invoke',
          unit: '1',
          asInt: '1',
          record: fun.record,
          attributes: metricAttributes,
        })
      );
    }

    // Reports will be sent separately and we only want to send this data once
    if (report && report.record && (!sentRequest || !sentRequest.report)) {
      metrics.push(
        createHistogramMetric({
          name: 'faas.duration',
          unit: '1',
          count: '1',
          sum: report.record.metrics.durationMs,
          record: fun.record,
          attributes: metricAttributes,
        }),
        createHistogramMetric({
          name: 'faas.memory',
          unit: '1',
          count: '1',
          sum: (report.record.metrics.maxMemoryUsedMB / report.record.metrics.memorySizeMB) * 100,
          record: fun.record,
          attributes: metricAttributes,
        })
      );

      if ('initDurationMs' in report.record.metrics) {
        metrics.push(
          createHistogramMetric({
            name: 'faas.coldstart_duration',
            unit: '1',
            count: '1',
            sum: report.record.metrics.initDurationMs,
            record: fun.record,
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
  });

const createTracePayload = (groupedByRequestId, sentRequests) =>
  Object.keys(groupedByRequestId)
    // Check if the trace has already been sent so we don't want to send the same trace again
    .filter((requestId) => {
      const sentRequest = sentRequests.find(({ requestId: rId }) => rId === requestId);
      return !(sentRequest && sentRequest.trace);
    })
    .map((requestId) => {
      const data = groupedByRequestId[requestId];
      const report = data['platform.report'] || {};
      // We are uploading report data async so we want to ignore traces on reports
      const fun = data.function || {};
      const traces = data.traces || {};

      if (!fun.record) {
        logMessage('Trace fun - ', JSON.stringify(data));
      }

      if (!traces.record) {
        logMessage('Trace traces - ', JSON.stringify(data));
      }

      if (!report.record) {
        logMessage('Trace Report - ', JSON.stringify(data));
      }

      const metricAttributes = createMetricAttributes(fun, report);

      traces.record.resourceSpans = [
        {
          resource: {
            attributes: createResourceAttributes(fun),
          },
          instrumentationLibrarySpans: [
            ...(traces.record.resourceSpans || [])[0].instrumentationLibrarySpans.map(
              (librarySpans) => {
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
              }
            ),
          ],
        },
      ];

      return batchOverflowSpans(traces.record);
    })
    .reduce((arr, originalList) => [...arr, ...originalList], []);

module.exports = {
  createLogPayload,
  createTracePayload,
  createMetricsPayload,
};
