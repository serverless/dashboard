'use strict';

const serverlessSdk = global.serverlessSdk || require('../');

serverlessSdk._deferredTelemetryRequests = [];

if (!serverlessSdk._isDevMode) {
  // No dev mode, export noop function
  module.exports.flush = () => {};
  return;
}

const traceProto = require('@serverless/sdk-schema/dist/trace');
const sendTelemetry = require('./send-telemetry');
const invocationContextAccessor = require('./invocation-context-accessor');

const pendingSpans = [];
let isScheduled = false;
let timeoutId = null;
const sendSpans = () => {
  isScheduled = false;
  clearTimeout(timeoutId);
  if (!pendingSpans.length) return;
  const payload = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: '@serverless/aws-lambda-sdk', version: serverlessSdk.version },
    },
    spans: pendingSpans.map((span) => {
      const result = span.toProtobufObject();
      span.input = null;
      span.output = null;
      return result;
    }),
    events: [],
  };
  pendingSpans.length = 0;
  serverlessSdk._deferredTelemetryRequests.push(
    sendTelemetry('trace', traceProto.TracePayload.encode(payload).finish())
  );
};

serverlessSdk._traceSpanEmitter.on('close', (traceSpan) => {
  pendingSpans.push(traceSpan);
  if (!isScheduled) {
    isScheduled = true;
    const context = invocationContextAccessor.value;
    timeoutId = setTimeout(
      sendSpans,
      Math.min(100, Math.max(0, context ? context.getRemainingTimeInMillis() - 50 : 100))
    );
  }
});

module.exports.flush = sendSpans;
