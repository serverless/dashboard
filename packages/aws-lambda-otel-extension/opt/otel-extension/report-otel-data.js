'use strict';

const reportModes = new Set(['json', 'proto']);
const REPORT_TYPE = reportModes.has(process.env.SLS_OTEL_REPORT_TYPE)
  ? process.env.SLS_OTEL_REPORT_TYPE
  : 'proto';

const METRICS_URL = process.env.SLS_OTEL_REPORT_METRICS_URL;
const TRACES_URL = process.env.SLS_OTEL_REPORT_METRICS_URL;
const EXTRA_REQUEST_HEADERS = process.env.SLS_OTEL_REPORT_REQUEST_HEADERS
  ? Object.fromEntries(new URLSearchParams(process.env.SLS_OTEL_REPORT_REQUEST_HEADERS).entries())
  : {};

const protobuf = REPORT_TYPE === 'proto' ? require('protobufjs') : null;
const fetch = require('node-fetch');

const processData = async (data, { url, protobufPath, protobufType }) => {
  if (REPORT_TYPE === 'proto') {
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
                    // const message = Buffer.from(encoded).toString('base64');
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
            'content-type': REPORT_TYPE === 'proto' ? 'application/x-protobuf' : 'application/json',
            ...EXTRA_REQUEST_HEADERS,
          },
        });
        if (!res.ok) console.log(res);
      })
    );
  } else {
    console.log('Report data:', REPORT_TYPE === 'json' ? JSON.stringify(data, null, 2) : data);
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
