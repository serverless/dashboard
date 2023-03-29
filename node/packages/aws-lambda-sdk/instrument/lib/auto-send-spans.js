'use strict';

const serverlessSdk = require('./sdk');

const objHasOwnProperty = Object.prototype.hasOwnProperty;

serverlessSdk._deferredTelemetryRequests = [];

if (!serverlessSdk._isDevMode) {
  // No dev mode, export noop function
  module.exports.flush = () => {};
  return;
}

const traceProto = require('@serverless/sdk-schema/dist/trace');
const sendTelemetry = require('./send-telemetry');
const invocationContextAccessor = require('./invocation-context-accessor');
const filterCapturedEvent = require('./filter-captured-event');

const pendingSpans = [];
let pendingCapturedEvents = [];
let isScheduled = false;
let timeoutId = null;
const sendData = () => {
  try {
    isScheduled = false;
    clearTimeout(timeoutId);
    pendingCapturedEvents = pendingCapturedEvents.filter(filterCapturedEvent);
    if (!pendingSpans.length && !pendingCapturedEvents.length) return;
    const payload = {
      slsTags: {
        orgId: serverlessSdk.orgId,
        service: process.env.AWS_LAMBDA_FUNCTION_NAME,
        sdk: {
          name: '@serverless/aws-lambda-sdk',
          version: serverlessSdk.version,
          runtime: 'nodejs',
        },
      },
      spans: pendingSpans.map((span) => span.toProtobufObject()),
      events: pendingCapturedEvents.map((capturedEvent) => capturedEvent.toProtobufObject()),
      customTags: objHasOwnProperty.call(serverlessSdk, '_customTags')
        ? JSON.stringify(serverlessSdk._customTags)
        : undefined,
    };
    pendingSpans.length = 0;
    pendingCapturedEvents.length = 0;
    if (!invocationContextAccessor.value) {
      // Root span comes with "aws.lambda.*" tags, which require unconditionally requestId
      // which we don't have if handler crashed at initialization.
      payload.spans = payload.spans.filter((span) => span.name !== 'aws.lambda');
    }
    serverlessSdk._deferredTelemetryRequests.push(
      sendTelemetry('trace', traceProto.TracePayload.encode(payload).finish())
    );
  } catch (error) {
    serverlessSdk._reportError(error);
  }
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
  pendingCapturedEvents.push(capturedEvent);
  scheduleEventually();
});

module.exports.flush = sendData;
