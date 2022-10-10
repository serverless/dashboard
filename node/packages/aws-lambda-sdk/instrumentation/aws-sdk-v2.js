'use strict';

const ensureObject = require('type/object/ensure');
const ensureConstructor = require('type/constructor/ensure');
const doNotInstrumentFollowingHttpRequest =
  require('../lib/instrumentation/http').ignoreFollowingRequest;
const serviceMapper = require('../lib/instrumentation/aws-sdk/service-mapper');

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
  Sdk.Request.prototype.runTo = function runTo(state, done) {
    // identifier
    const serviceName =
      this.service.constructor.serviceIdentifier ||
      this.service.constructor.__super__.serviceIdentifier;
    const tagMapper = serviceMapper.get(serviceName);
    const operationName = this.operation.toLowerCase();
    const params = this.params;
    const traceSpan = serverlessSdk.createTraceSpan(`aws.sdk.${serviceName}.${operationName}`, {
      tags: {
        'aws.sdk.region': this.service.config.region,
        'aws.sdk.signature_version': this.service.config.signatureVersion,
        'aws.sdk.service': serviceName,
        'aws.sdk.operation': operationName,
        'aws.sdk.request_body': shouldMonitorRequestResponse ? JSON.stringify(params) : null,
      },
    });
    tagMapper?.params?.(traceSpan, params);
    this.on('complete', (response) => {
      if (response.requestId) traceSpan.tags.set('aws.sdk.request_id', response.requestId);
      if (response.error) {
        traceSpan.tags.set('aws.sdk.error', response.error.message);
      } else {
        if (shouldMonitorRequestResponse) {
          traceSpan.tags.set('aws.sdk.response_body', JSON.stringify(response.data));
        }
        tagMapper?.responseData?.(traceSpan, response.data);
      }
      if (!traceSpan.endTime) traceSpan.close();
    });
    doNotInstrumentFollowingHttpRequest();
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

const serverlessSdk = global.serverlessSdk || require('../');
