'use strict';

const createHttpRequest = require('http').request;
const createHttpsRequest = require('https').request;
const { debugLog } = require('./helper');

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
const LOGS_URL = process.env.SLS_OTEL_REPORT_LOGS_URL;
const REQUEST_RESPONSE_URL = process.env.SLS_OTEL_REPORT_REQUEST_RESPONSE_URL;

const protobuf = REPORT_TYPE === 'proto' ? require('protobufjs') : null;
// aws-sdk is provided in Lambda runtime
// eslint-disable-next-line import/no-unresolved
const s3Client = S3_BUCKET ? new (require('/var/runtime/node_modules/aws-sdk').S3)() : null;

let httpRequestIdTracker = 0;
const processData = async (jsonData, { url, s3Key, protobufPath, protobufType }) => {
  const requestData =
    REPORT_TYPE === 'proto'
      ? (
          await Promise.all(
            jsonData.map(
              async (datum) =>
                new Promise((resolve) => {
                  try {
                    protobuf.load(`${__dirname}${protobufPath}`, (err, root) => {
                      try {
                        if (err) throw err;

                        const ServiceRequest = root.lookupType(protobufType);
                        resolve(ServiceRequest.encode(datum).finish());
                      } catch (error) {
                        debugLog('Buffer error: ', error);
                        resolve(null);
                      }
                    });
                  } catch (error) {
                    debugLog('Could not convert to proto buff: ', error);
                    resolve(null);
                  }
                })
            )
          )
        ).filter(Boolean)
      : jsonData;

  if (url) {
    await Promise.all(
      requestData.map(async (datum, index) => {
        const body = REPORT_TYPE === 'proto' ? datum : JSON.stringify(datum);
        const headers = {
          'accept-encoding': 'gzip',
          'content-type': REPORT_TYPE === 'proto' ? 'application/x-protobuf' : 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...EXTRA_REQUEST_HEADERS,
        };
        await new Promise((resolve, reject) => {
          const httpRequestId = ++httpRequestIdTracker;
          const createRequest = url.startsWith('https') ? createHttpsRequest : createHttpRequest;
          debugLog(`Request [${httpRequestId}]:`, url, JSON.stringify(jsonData[index]));
          const requestStartTime = process.hrtime.bigint();
          const request = createRequest(
            url,
            {
              method: 'post',
              headers,
            },
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
      })
    );
  } else if (s3Client && s3Key) {
    await s3Client
      .putObject({
        Body: Buffer.from(JSON.stringify(requestData)),
        Bucket: S3_BUCKET,
        Key: s3Key + (REPORT_TYPE === 'proto' ? '.proto' : '.json'),
      })
      .promise();
  } else {
    console.log(REPORT_TYPE === 'json' ? JSON.stringify(requestData) : requestData);
  }
};

const processLogData = async (data, { url }) => {
  if (url) {
    const body = JSON.stringify(data);
    const headers = {
      'accept-encoding': 'gzip',
      'content-type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...EXTRA_REQUEST_HEADERS,
    };
    await new Promise((resolve, reject) => {
      const httpRequestId = ++httpRequestIdTracker;
      const createRequest = url.startsWith('https') ? createHttpsRequest : createHttpRequest;
      debugLog(`Request [${httpRequestId}]:`, url, JSON.stringify(data));
      const requestStartTime = process.hrtime.bigint();
      const request = createRequest(
        url,
        {
          method: 'post',
          headers,
        },
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
  } else if (process.env.SLS_TEST_PRINT_LOG_EVENT) {
    console.log(REPORT_TYPE === 'json' ? JSON.stringify(data) : data);
  }
};

const processRequestResponseEventData = async (data, { url }) => {
  if (url) {
    const body = JSON.stringify(data);
    const headers = {
      'accept-encoding': 'gzip',
      'content-type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...EXTRA_REQUEST_HEADERS,
    };
    await new Promise((resolve, reject) => {
      const httpRequestId = ++httpRequestIdTracker;
      const createRequest = url.startsWith('https') ? createHttpsRequest : createHttpRequest;
      debugLog(`Request [${httpRequestId}]:`, url, JSON.stringify(data));
      const requestStartTime = process.hrtime.bigint();
      const request = createRequest(
        url,
        {
          method: 'post',
          headers,
        },
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
  }
};

module.exports = {
  metrics: async (data) =>
    processData(data, {
      url: METRICS_URL,
      // TODO: Once possible, switch to invocation id
      s3Key: `${process.env.AWS_LAMBDA_FUNCTION_NAME}/metrics/${new Date().toISOString()}`,
      protobufPath: '/proto/metric-service.proto',
      protobufType: 'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
    }),
  traces: async (data) =>
    processData(data, {
      url: TRACES_URL,
      // TODO: Once possible, switch to invocation id
      s3Key: `${process.env.AWS_LAMBDA_FUNCTION_NAME}/traces/${new Date().toISOString()}`,
      protobufPath: '/proto/trace-service.proto',
      protobufType: 'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
    }),
  logs: async (data) =>
    processLogData(data, {
      url: LOGS_URL,
    }),
  requestResponse: async (data) =>
    processRequestResponseEventData(data, {
      url: REQUEST_RESPONSE_URL,
    }),
};
