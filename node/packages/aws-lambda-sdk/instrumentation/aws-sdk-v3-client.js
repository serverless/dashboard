'use strict';

const ensureObject = require('type/object/ensure');
const doNotInstrumentFollowingHttpRequest =
  require('../lib/instrumentation/http').ignoreFollowingRequest;

const instrumentedClients = new WeakMap();

const serviceMapper = require('../lib/instrumentation/aws-sdk/service-mapper');

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
        const operationName = context.commandName.slice(0, -'Command'.length).toLowerCase();
        const tagMapper = serviceMapper.get(serviceName);
        const traceSpan = serverlessSdk.createTraceSpan(`aws.sdk.${serviceName}.${operationName}`, {
          tags: {
            'aws.sdk.service': serviceName,
            'aws.sdk.operation': operationName,
            'aws.sdk.signature_version': 'v4',
          },
          input: shouldMonitorRequestResponse ? JSON.stringify(args.input) : null,
        });
        if (tagMapper && tagMapper.params) tagMapper.params(traceSpan, args.input);
        const deferredRegion = client.config
          .region()
          .then((region) => traceSpan.tags.set('aws.sdk.region', region));

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
          if (error.$metadata) traceSpan.tags.set('aws.sdk.request_id', error.$metadata.requestId);
          if (!traceSpan.endTime) traceSpan.close();
          throw error;
        } else {
          traceSpan.tags.set('aws.sdk.request_id', response.output.$metadata.requestId);
          if (shouldMonitorRequestResponse) traceSpan.output = JSON.stringify(response.output);
          if (tagMapper && tagMapper.responseData) {
            tagMapper.responseData(traceSpan, response.output);
          }
          if (!traceSpan.endTime) traceSpan.close();
          return response;
        }
      };
      const httpRequestMiddleware = (next) => async (args) => {
        doNotInstrumentFollowingHttpRequest();
        return next(args);
      };

      stack.add(awsRequestMiddleware);
      stack.add(httpRequestMiddleware, { step: 'deserialize', priority: 'low' });

      uninstall = () => {
        if (instrumentedClients.has(client)) return;
        stack.remove(awsRequestMiddleware);
        stack.remove(httpRequestMiddleware);
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

const serverlessSdk = global.serverlessSdk || require('../');
