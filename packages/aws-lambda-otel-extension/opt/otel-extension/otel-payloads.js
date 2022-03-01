'use strict';

const get = require('lodash.get');
const { resourceAttributes, measureAttributes, logMessage } = require('./helper');

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
    ...(report
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

const createMetricsPayload = (groupedByRequestId, sentRequests) =>
  Object.keys(groupedByRequestId).map((requestId) => {
    const sentRequest = sentRequests[requestId];
    const data = groupedByRequestId[requestId];
    const report = data['platform.report'] || {};
    const fun = data.function || {};

    const path = get(fun.record, 'httpPath');
    const statusCode = get(fun.record, 'httpStatusCode');

    if (!fun.record) {
      logMessage('Metrics fun - ', JSON.stringify(data));
    }

    if (!report.record) {
      logMessage('Metrics Report - ', JSON.stringify(data));
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
    if (report && (!sentRequest || !sentRequest.report)) {
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
      const sentRequest = sentRequests[requestId];
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

      return traces.record;
    });

module.exports = {
  createTracePayload,
  createMetricsPayload,
};
