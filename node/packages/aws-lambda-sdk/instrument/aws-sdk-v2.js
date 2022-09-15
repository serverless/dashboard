'use strict';

const ensureObject = require('type/object/ensure');
const ensureConstructor = require('type/constructor/ensure');

const doNotInstrumentFollowingHttpRequest =
  require('../lib/instrument/http').ignoreFollowingRequest;
const serviceMapper = require('../lib/instrument/aws-sdk/service-mapper');

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
  const originalRunTo = Sdk.Request.prototype.runTo;
  Sdk.Request.prototype.runTo = function runTo(state, done) {
    // identifier
    const serviceName =
      this.service.constructor.serviceIdentifier ||
      this.service.constructor.__super__.serviceIdentifier;
    const tagMapper = serviceMapper.get(serviceName);
    if (tagMapper) {
      const operationName = this.operation.toLowerCase();
      const params = this.params;
      const traceSpan = (
        traceSpans.awsLambdaInvocation || traceSpans.awsLambdaInitialization
      ).createSubSpan(`aws.sdk.${serviceName}.${operationName}`, {
        tags: {
          'aws.sdk.region': this.service.config.region,
          'aws.sdk.signature_version': this.service.config.signatureVersion,
          'aws.sdk.service': serviceName,
          'aws.sdk.operation': operationName,
        },
        onCloseByParent: () => {
          process.stderr.write(
            "Serverless SDK Warning: AWS SDK request didn't end before end of " +
              'lambda invocation (or initialization)\n'
          );
        },
      });
      tagMapper.params?.(traceSpan, params);
      this.on('complete', (response) => {
        if (response.requestId) traceSpan.tags.set('aws.sdk.request_id', response.requestId);
        if (response.error) traceSpan.tags.set('aws.sdk.error', response.error.message);
        else tagMapper.responseData?.(traceSpan, response.data);
        if (!traceSpan.endTime) traceSpan.close();
      });
      doNotInstrumentFollowingHttpRequest();
    }
    return originalRunTo.call(this, state, done);
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

const { traceSpans } = require('../');
