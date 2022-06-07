'use strict';

const createHttpRequest = require('http').request;
const createHttpsRequest = require('https').request;
const { debugLog } = require('./helper');
const userSettings = require('./user-settings');

const isUrl = RegExp.prototype.test.bind(/^https?:\/\//);
const s3UrlPattern = /^s3:\/\/(?<bucket>[^/]+)(\/(?<rootKey>.+))?/;

const extraRequestHeaders = userSettings.common.destination.requestHeaders
  ? Object.fromEntries(
      new URLSearchParams(userSettings.common.destination.requestHeaders).entries()
    )
  : {};

const getProtobufLoad = () => require('protobufjs').load;

const s3Client = ['logs', 'metrics', 'request', 'response', 'traces'].some((name) => {
  const destination = userSettings[name].destination;
  return destination && destination.startsWith('s3://');
})
  ? // aws-sdk is provided in Lambda runtime
    // eslint-disable-next-line import/no-unresolved
    new (require('/var/runtime/node_modules/aws-sdk').S3)()
  : null;

let httpRequestIdTracker = 0;
const prepareReport = async (data, { outputType }, { protobuf }) => {
  if (outputType !== 'protobuf') return data;
  const root = await getProtobufLoad()(`${__dirname}${protobuf.path}`);
  const ServiceRequest = root.lookupType(protobuf.type);
  return ServiceRequest.encode(data).finish();
};

const sendReport = async (data, { destination, outputType }) => {
  const body = outputType === 'protobuf' ? data : JSON.stringify(data);
  const headers = {
    'accept-encoding': 'gzip',
    'content-type': outputType === 'protobuf' ? 'application/x-protobuf' : 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...extraRequestHeaders,
  };
  await new Promise((resolve, reject) => {
    const httpRequestId = ++httpRequestIdTracker;
    const createRequest = destination.startsWith('https') ? createHttpsRequest : createHttpRequest;
    debugLog(`Request [${httpRequestId}]:`, destination);
    const requestStartTime = process.hrtime.bigint();
    const request = createRequest(destination, { method: 'post', headers }, (response) => {
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
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
};

const storeReport = async (data, { destination, outputType }, { s3 }) => {
  const { bucket, rootKey } = destination.match(s3UrlPattern).groups;
  await s3Client
    .putObject({
      Body: Buffer.from(outputType === 'protobuf' ? data : JSON.stringify(data)),
      Bucket: bucket,
      Key:
        (rootKey ? `${rootKey}/` : '') + s3.key + (outputType === 'protobuf' ? '.proto' : '.json'),
    })
    .promise();
};

const protobufConfigs = {
  metrics: {
    path: '/proto/metric-service.proto',
    type: 'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
  },
  traces: {
    path: '/proto/trace-service.proto',
    type: 'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
  },
};

module.exports = async (name, data) => {
  debugLog(`Report ${name}:`, JSON.stringify(data));
  const settings = userSettings[name];
  if (protobufConfigs[name]) {
    data = await prepareReport(data, settings, {
      protobuf: protobufConfigs[name],
    });
  }
  if (settings.destination && isUrl(settings.destination)) {
    await sendReport(data, settings);
  } else if (settings.destination && settings.destination.startsWith('s3://')) {
    await storeReport(data, settings, {
      s3: { key: `${process.env.AWS_LAMBDA_FUNCTION_NAME}/metrics/${new Date().toISOString()}` },
    });
  } else {
    process.stdout.write(`⚡ ${name}: ${JSON.stringify(data)}\n`);
  }
};
