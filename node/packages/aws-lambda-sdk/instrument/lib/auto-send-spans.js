'use strict';

const serverlessSdk = require('./sdk');

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
const pendingCapturedEvents = [];
let isScheduled = false;
let timeoutId = null;
const sendData = () => {
  isScheduled = false;
  clearTimeout(timeoutId);
  if (!pendingSpans.length && !pendingCapturedEvents.length) return;
  const payload = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: '@serverless/aws-lambda-sdk', version: serverlessSdk.version },
    },
    spans: pendingSpans.map((span) => span.toProtobufObject()),
    events: pendingCapturedEvents.map((capturedEvent) => capturedEvent.toProtobufObject()),
  };
  pendingSpans.length = 0;
  pendingCapturedEvents.length = 0;
  serverlessSdk._deferredTelemetryRequests.push(
    sendTelemetry('trace', traceProto.TracePayload.encode(payload).finish())
  );
};

const scheduleEventually = () => {
  if (isScheduled) return;
  isScheduled = true;
  const context = invocationContextAccessor.value;
  timeoutId = setTimeout(
    sendData,
    Math.min(50, Math.max(0, context ? context.getRemainingTimeInMillis() - 50 : 50))
  );
};

serverlessSdk._eventEmitter.on('trace-span-close', (traceSpan) => {
  pendingSpans.push(traceSpan);
  scheduleEventually();
});

serverlessSdk._eventEmitter.on('captured-event', (capturedEvent) => {
  if (capturedEvent._origin === 'nodeConsole') return;
  pendingCapturedEvents.push(capturedEvent);
  scheduleEventually();
});

module.exports.flush = sendData;
