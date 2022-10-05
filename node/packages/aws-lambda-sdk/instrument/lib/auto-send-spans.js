'use strict';

const serverlessSdk = global.serverlessSdk || require('../');

if (!serverlessSdk._isDevMode) {
  // No dev mode, export noop function
  module.exports.flush = () => {};
  return;
}

const traceProto = require('@serverless/sdk-schema/dist/trace');
const sendTelemetry = require('./send-telemetry');
const devModeOnlyTags = require('./dev-mode-only-tags');

const pendingSpans = [];
let isScheduled = false;
const sendSpans = () => {
  isScheduled = false;
  if (!pendingSpans.length) return;
  const payload = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: '@serverless/aws-lambda-sdk', version: serverlessSdk.version },
    },
    spans: pendingSpans.map((span) => {
      const result = span.toProtobufObject();
      for (const tagName of span.tags.keys()) {
        if (devModeOnlyTags.has(tagName)) span.tags.delete(tagName);
      }
      return result;
    }),
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
    process.nextTick(sendSpans);
  }
});

module.exports.flush = sendSpans;
