'use strict';

const reportModes = new Set(['json', 'proto']);
const MODE = reportModes.has(process.env.SLS_OTEL_REPORT_MODE)
  ? process.env.SLS_OTEL_REPORT_MODE
  : 'proto';

const METRICS_URL = `${process.env.SLS_OTEL_REPORT_URL}/v1/metrics`;
const TRACES_URL = `${process.env.SLS_OTEL_REPORT_URL}/v1/traces`;
const EXTRA_REQUEST_HEADERS = process.env.SLS_OTEL_REPORT_REQUEST_HEADERS
  ? Object.fromEntries(new URLSearchParams(process.env.SLS_OTEL_REPORT_REQUEST_HEADERS).entries())
  : {};

const protobuf = MODE === 'proto' ? require('protobufjs') : null;
const fetch = require('node-fetch');

const processData = async (data, { url, protobufPath, protobufType }) => {
  if (MODE === 'proto') {
    data = (
      await Promise.all(
        data.map(
          async (datum) =>
            new Promise((resolve) => {
              try {
                protobuf.load(`${__dirname}${protobufPath}`, (err, root) => {
                  try {
                    if (err) throw err;

                    const ServiceRequest = root.lookupType(protobufType);
                    resolve(ServiceRequest.encode(datum).finish());
                  } catch (error) {
                    console.log('Buffer error: ', error);
                    resolve(null);
                  }
                });
              } catch (error) {
                console.log('Could not convert to proto buff', error);
                resolve(null);
              }
            })
        )
      )
    ).filter(Boolean);
  }
  if (url) {
    await Promise.all(
      data.map(async (datum) => {
        const res = await fetch(url, {
          method: 'post',
          body: datum,
          headers: {
            'accept-encoding': 'gzip',
            'content-type': MODE === 'proto' ? 'application/x-protobuf' : 'application/json',
            ...EXTRA_REQUEST_HEADERS,
          },
        });
        if (!res.ok) console.log(res);
      })
    );
  } else {
    console.log('Report data:', JSON.stringify(data, null, 2));
  }
};

module.exports = {
  metrics: async (data) =>
    processData(data, {
      url: METRICS_URL,
      protobufPath: '/proto/metric_service.proto',
      protobufType: 'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
    }),
  traces: async (data) =>
    processData(data, {
      url: TRACES_URL,
      protobufPath: '/proto/trace_service.proto',
      protobufType: 'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
    }),
};
