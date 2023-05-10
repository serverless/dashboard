'use strict';

const ensureObject = require('type/object/ensure');
const ensureConstructor = require('type/constructor/ensure');
const serviceMapper = require('../lib/instrumentation/aws-sdk/service-mapper');
const safeStringify = require('../lib/instrumentation/aws-sdk/safe-stringify');

const instrumentedSdks = new WeakMap();

module.exports.install = (Sdk) => {
  if (instrumentedSdks.has(Sdk)) return instrumentedSdks.get(Sdk);
  ensureObject(Sdk, { errorMessage: '%v is not an instance of AWS SDK' });
  ensureConstructor(Sdk.Request, { errorMessage: 'Passed argument is not an instance of AWS SDK' });
  if (typeof Sdk.VERSION !== 'string') {
    throw new TypeError('Passed argument is not an instance of AWS SDK');
  }
  if (!Sdk.VERSION.startsWith('2.')) {
    throw new TypeError(`Unsupported AWS SDK version: ${Sdk.VERSION}`);
  }
  const shouldMonitorRequestResponse =
    serverlessSdk._isDevMode && !serverlessSdk._settings.disableRequestResponseMonitoring;
  const originalRunTo = Sdk.Request.prototype.runTo;
  const originalPresign = Sdk.Request.prototype.presign;
  Sdk.Request.prototype.presign = function presign(expires, callback) {
    // Presign only pre-configures request url but does not issue real AWS SDK request.
    // Ensure to not instrument such requests
    this.runTo = originalRunTo;
    return originalPresign.call(this, expires, callback);
  };
  Sdk.Request.prototype.runTo = function runTo(state, done) {
    let traceSpan;
    try {
      // identifier
      const serviceName =
        this.service.constructor.serviceIdentifier ||
        this.service.constructor.__super__.serviceIdentifier;
      const tagMapper = serviceMapper.get(serviceName);
      const operationName = this.operation.toLowerCase();
      const params = this.params;
      const inputString = (() => {
        if (!shouldMonitorRequestResponse) return null;
        const result = safeStringify(params);
        if (Buffer.byteLength(result) > serverlessSdk._maximumBodyByteLength) {
          serverlessSdk._reportNotice('Large body excluded', 'INPUT_BODY_TOO_LARGE', {
            _traceSpan: traceSpan,
          });
          return null;
        }
        return result;
      })();
      traceSpan = serverlessSdk._createTraceSpan(`aws.sdk.${serviceName}.${operationName}`, {
        tags: {
          'aws.sdk.region': this.service.config.region,
          'aws.sdk.signature_version': this.service.config.signatureVersion,
          'aws.sdk.service': serviceName,
          'aws.sdk.operation': operationName,
        },
        input: inputString,
        isBlackBox: true,
      });
      if (tagMapper && tagMapper.params) tagMapper.params(traceSpan, params);
      let wasCompleted = false;
      this.on('complete', (response) => {
        try {
          if (wasCompleted) {
            serverlessSdk._reportWarning(
              'Detected doubled handling for same AWS SDK request. ' +
                'It may happen if for the same request both callback and promise resolution ' +
                'is requested. Internally it creates two AWS SDK calls so such design should be avoided.\n',
              'AWS_SDK_DOUBLE_RESOLUTION',
              { type: 'USER' }
            );
            return;
          }
          wasCompleted = true;
          if (response.requestId) traceSpan.tags.set('aws.sdk.request_id', response.requestId);
          if (response.error) {
            // Fallback to error.name, as there are cases when AWS SDK returns error with no message:
            // https://github.com/aws/aws-sdk-js/issues/4330
            traceSpan.tags.set('aws.sdk.error', response.error.message || response.error.name);
          } else {
            if (shouldMonitorRequestResponse) {
              const outputString = safeStringify(response.data);
              if (Buffer.byteLength(outputString) > serverlessSdk._maximumBodyByteLength) {
                serverlessSdk._reportNotice('Large body excluded', 'OUTPUT_BODY_TOO_LARGE', {
                  _traceSpan: traceSpan,
                });
              } else {
                traceSpan.output = safeStringify(response.data);
              }
            }
            if (tagMapper && tagMapper.responseData) {
              tagMapper.responseData(traceSpan, response.data);
            }
          }
          if (!traceSpan.endTime) traceSpan.close();
        } catch (error) {
          serverlessSdk._reportError(error);
        }
      });
    } catch (error) {
      serverlessSdk._reportError(error);
      return originalRunTo.call(this, state, done);
    }
    try {
      return originalRunTo.call(this, state, done);
    } finally {
      traceSpan.closeContext();
    }
  };

  const uninstall = () => {
    if (!instrumentedSdks.has(Sdk)) return;
    Sdk.Request.prototype.runTo = originalRunTo;
    instrumentedSdks.delete(Sdk);
  };
  instrumentedSdks.set(Sdk, uninstall);
  return uninstall;
};

module.exports.uninstall = (client) => {
  const uninstall = instrumentedSdks.get(client);
  if (uninstall) uninstall();
};

const serverlessSdk = require('../');
