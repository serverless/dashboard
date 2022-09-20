'use strict';

const ensureObject = require('type/object/ensure');

const doNotInstrumentFollowingHttpRequest =
  require('../lib/instrument/http').ignoreFollowingRequest;

const instrumentedClients = new WeakMap();

const serviceMapper = require('../lib/instrument/aws-sdk/service-mapper');

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
  client.middlewareStack.use({
    applyToStack: (stack) => {
      // Middleware added to mark start and end of an complete API call.
      const awsRequestMiddleware = (next, context) => async (args) => {
        const operationName = context.commandName.slice(0, -'Command'.length).toLowerCase();
        const tagMapper = serviceMapper.get(serviceName);
        const traceSpan = (
          traceSpans.awsLambdaInvocation || traceSpans.awsLambdaInitialization
        ).createSubSpan(`aws.sdk.${serviceName}.${operationName}`, {
          tags: {
            'aws.sdk.service': serviceName,
            'aws.sdk.operation': operationName,
            'aws.sdk.signature_version': 'v4',
          },
          onCloseByParent: () => {
            process.stderr.write(
              "Serverless SDK Warning: AWS SDK request didn't end before end of " +
                'lambda invocation (or initialization)\n'
            );
          },
        });
        tagMapper?.params?.(traceSpan, args.input);
        const deferredRegion = client.config
          .region()
          .then((region) => traceSpan.tags.set('aws.sdk.region', region));
        const { response, error } = await (async () => {
          try {
            return { response: await next(args) };
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
          tagMapper?.responseData?.(traceSpan, response.output);
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

const { traceSpans } = require('../');
