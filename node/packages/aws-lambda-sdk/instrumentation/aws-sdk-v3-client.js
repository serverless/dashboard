'use strict';

const ensureObject = require('type/object/ensure');

const instrumentedClients = new WeakMap();

const serviceMapper = require('../lib/instrumentation/aws-sdk/service-mapper');
const safeStringify = require('../lib/instrumentation/aws-sdk/safe-stringify');

module.exports.install = (client) => {
  ensureObject(client, { errorMessage: '%v is not an instance of AWS SDK v3 client' });
  ensureObject(client.middlewareStack, {
    errorMessage: 'Passed argument is not an instance of AWS SDK v3 client',
  });
  if (instrumentedClients.has(client)) return instrumentedClients.get(client);
  const serviceName = (
    client.constructor.name.endsWith('Client')
      ? client.constructor.name.slice(0, -'Client'.length)
      : client.constructor.name
  ).toLowerCase();
  let uninstall;
  const shouldMonitorRequestResponse =
    serverlessSdk._isDevMode && !serverlessSdk._settings.disableRequestResponseMonitoring;
  client.middlewareStack.use({
    applyToStack: (stack) => {
      // Middleware added to mark start and end of an complete API call.
      const awsRequestMiddleware = (next, context) => async (args) => {
        let deferredRegion;
        let traceSpan;
        let tagMapper;
        try {
          const operationName = context.commandName.slice(0, -'Command'.length).toLowerCase();
          tagMapper = serviceMapper.get(serviceName);
          traceSpan = serverlessSdk._createTraceSpan(`aws.sdk.${serviceName}.${operationName}`, {
            tags: {
              'aws.sdk.service': serviceName,
              'aws.sdk.operation': operationName,
              'aws.sdk.signature_version': 'v4',
            },
            input: shouldMonitorRequestResponse ? safeStringify(args.input) : null,
            isBlackBox: true,
          });
          if (tagMapper && tagMapper.params) tagMapper.params(traceSpan, args.input);
          deferredRegion = client.config
            .region()
            .then((region) => traceSpan.tags.set('aws.sdk.region', region));
        } catch (error) {
          serverlessSdk._reportError(error);
          return next(args);
        }

        const nextDeferred = (() => {
          try {
            return next(args);
          } catch (error) {
            return Promise.reject(error);
          }
        })();
        traceSpan.closeContext();
        const { response, error } = await (async () => {
          try {
            return { response: await nextDeferred };
          } catch (requestError) {
            return { error: requestError };
          }
        })();
        await deferredRegion;
        if (error) {
          if (error.$metadata && error.$metadata.requestId) {
            traceSpan.tags.set('aws.sdk.request_id', error.$metadata.requestId);
          }
          traceSpan.tags.set('aws.sdk.error', error.message || error.name);
          if (!traceSpan.endTime) traceSpan.close();
          throw error;
        } else {
          if (!response.output.$metadata.requestId) {
            traceSpan.destroy(); // Not a real AWS request (e.g. S3 presigned URL)
            return response;
          }
          traceSpan.tags.set('aws.sdk.request_id', response.output.$metadata.requestId);
          if (shouldMonitorRequestResponse) traceSpan.output = safeStringify(response.output);
          if (tagMapper && tagMapper.responseData) {
            try {
              tagMapper.responseData(traceSpan, response.output);
            } catch (sdkError) {
              serverlessSdk._reportError(sdkError);
            }
          }
          if (!traceSpan.endTime) traceSpan.close();
          return response;
        }
      };

      stack.add(awsRequestMiddleware);

      uninstall = () => {
        if (instrumentedClients.has(client)) return;
        stack.remove(awsRequestMiddleware);
        instrumentedClients.delete(client);
      };
    },
  });

  instrumentedClients.set(client, uninstall);
  return uninstall;
};

module.exports.uninstall = (client) => {
  const uninstall = instrumentedClients.get(client);
  if (uninstall) uninstall();
};

const serverlessSdk = require('../');
