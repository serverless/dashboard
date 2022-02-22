'use strict';

const reportModes = new Set(['json', 'proto']);
const REPORT_TYPE = reportModes.has(process.env.SLS_OTEL_REPORT_TYPE)
  ? process.env.SLS_OTEL_REPORT_TYPE
  : 'proto';

const METRICS_URL = process.env.SLS_OTEL_REPORT_METRICS_URL;
const TRACES_URL = process.env.SLS_OTEL_REPORT_TRACES_URL;
const EXTRA_REQUEST_HEADERS = process.env.SLS_OTEL_REPORT_REQUEST_HEADERS
  ? Object.fromEntries(new URLSearchParams(process.env.SLS_OTEL_REPORT_REQUEST_HEADERS).entries())
  : {};
const S3_BUCKET = process.env.SLS_OTEL_REPORT_S3_BUCKET;

const protobuf = REPORT_TYPE === 'proto' ? require('protobufjs') : null;
// aws-sdk is provided in Lambda runtime
// eslint-disable-next-line import/no-unresolved
const s3Client = S3_BUCKET ? new (require('/var/runtime/node_modules/aws-sdk').S3)() : null;
const fetch = require('node-fetch');

const processData = async (data, { url, s3Key, protobufPath, protobufType }) => {
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
  } else if (s3Client && s3Key) {
    await s3Client
      .putObject({
        Body: Buffer.from(JSON.stringify(data)),
        Bucket: S3_BUCKET,
        Key: s3Key + (REPORT_TYPE === 'proto' ? '.proto' : '.json'),
      })
      .promise();
  } else {
    console.log(REPORT_TYPE === 'json' ? JSON.stringify(data) : data);
  }
};

module.exports = {
  metrics: async (data) =>
    processData(data, {
      url: METRICS_URL,
      // TODO: Once possible, switch to invocation id
      s3Key: `${process.env.AWS_LAMBDA_FUNCTION_NAME}/metrics/${new Date().toISOString()}`,
      protobufPath: '/proto/metric_service.proto',
      protobufType: 'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
    }),
  traces: async (data) =>
    processData(data, {
      url: TRACES_URL,
      // TODO: Once possible, switch to invocation id
      s3Key: `${process.env.AWS_LAMBDA_FUNCTION_NAME}/traces/${new Date().toISOString()}`,
      protobufPath: '/proto/trace_service.proto',
      protobufType: 'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
    }),
};
