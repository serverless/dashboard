'use strict';

const https = require('https');
const {
  debugLog,
  keepAliveAgents: { https: keepAliveAgent },
} = require('./helper');
const userSettings = require('./user-settings');

const altDestination = userSettings._altDestination;

const s3UrlPattern = /^s3:\/\/(?<bucket>[^/]+)(\/(?<rootKey>.+))?/;
const reportType = process.env.SLS_TEST_EXTENSION_REPORT_TYPE === 'json' ? 'json' : 'protobuf';
const extraRequestHeaders = { serverless_token: userSettings.ingestToken };

const s3Client =
  altDestination && altDestination.startsWith('s3://')
    ? // aws-sdk is provided in Lambda runtime
      // eslint-disable-next-line import/no-unresolved
      new (require('/var/runtime/node_modules/aws-sdk').S3)()
    : null;

const backendUrl =
  process.env.SERVERLESS_PLATFORM_STAGE === 'dev'
    ? 'https://core.serverless-dev.com'
    : 'https://core.serverless.com';

const ingestionServerUrl = `${backendUrl}/ingestion/kinesis`;

const urls = {
  logs: `${ingestionServerUrl}/v1/logs`,
  metrics: `${ingestionServerUrl}/v1/metrics`,
  request: `${ingestionServerUrl}/v1/request-response`,
  response: `${ingestionServerUrl}/v1/request-response`,
  traces: `${ingestionServerUrl}/v1/traces`,
};

let httpRequestIdTracker = 0;

const sendReport = async (data, { outputType, url }) => {
  const body = outputType === 'protobuf' ? data : JSON.stringify(data);
  const headers = {
    'accept-encoding': 'gzip',
    'content-type': outputType === 'protobuf' ? 'application/x-protobuf' : 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...extraRequestHeaders,
  };
  await new Promise((resolve, reject) => {
    const httpRequestId = ++httpRequestIdTracker;
    debugLog(`Request [${httpRequestId}]:`, url);
    const requestStartTime = process.hrtime.bigint();
    const request = https.request(
      url,
      { agent: keepAliveAgent, method: 'post', headers },
      (response) => {
        if (response.statusCode === 200) {
          debugLog(
            `Request [${httpRequestId}]: ok in: ${Math.round(
              Number(process.hrtime.bigint() - requestStartTime) / 1000000
            )}ms`
          );
          resolve();
          return;
        }
        let responseText = '';
        response.on('data', (chunk) => {
          responseText += String(chunk);
        });
        response.on('end', () => {
          debugLog(
            `Request [${httpRequestId}]: failed in: ${Math.round(
              Number(process.hrtime.bigint() - requestStartTime) / 1000000
            )}ms with: [${response.status}] ${responseText}`
          );
          resolve();
        });
      }
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
};

const storeReport = async (data, { s3, outputType }) => {
  const { bucket, rootKey } = altDestination.match(s3UrlPattern).groups;
  await s3Client
    .putObject({
      Body: Buffer.from(outputType === 'protobuf' ? data : JSON.stringify(data)),
      Bucket: bucket,
      Key:
        (rootKey ? `${rootKey}/` : '') + s3.key + (outputType === 'protobuf' ? '.proto' : '.json'),
    })
    .promise();
};

const proto = require('./proto');

const protobufConfigs = {
  metrics: proto.opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest,
  traces: proto.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest,
};

module.exports = async (name, data) => {
  debugLog(`Report ${name}:`, JSON.stringify(data));
  const outputType = protobufConfigs[name] && reportType !== 'json' ? 'protobuf' : 'json';
  if (outputType === 'protobuf') data = protobufConfigs[name].encode(data).finish();
  if (!altDestination) {
    await sendReport(data, { outputType, url: urls[name] });
  } else if (altDestination.startsWith('s3://')) {
    await storeReport(data, {
      s3: { key: `${process.env.AWS_LAMBDA_FUNCTION_NAME}/metrics/${new Date().toISOString()}` },
      outputType,
    });
  } else {
    process.stdout.write(`⚡ ${name}: ${JSON.stringify(data)}\n`);
  }
};
