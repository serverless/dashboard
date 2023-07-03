// This file is replaced with prebuilt bundle in actual extension layer

// Custom handler, runs original handler ensuring Serverless SDK instrumentation

'use strict';

// We need to ensure the node path always contains the runtime path. If it does not
// We fail to resolve our local import of `@serverless/sdk` in the `serverlessSdk` initialization at the root of this
// package.
if (process.env.NODE_PATH && !process.env.NODE_PATH.includes('/opt/nodejs/node_modules')) {
  process.env.NODE_PATH += ':/opt/nodejs/node_modules';
  require('module').Module._initPaths();
}

process.env._HANDLER = process.env._ORIGIN_HANDLER;
delete process.env._ORIGIN_HANDLER;

const handlerModuleInstruction = EvalError.$serverlessHandlerModuleInstruction;
delete EvalError.$serverlessHandlerModuleInstruction;

const path = require('path');

// 1. Initialize SDK instrumentation
const serverlessSdk = (() => {
  try {
    require.resolve('@serverless/aws-lambda-sdk');
  } catch {
    return require('../');
  }

  // eslint-disable-next-line import/no-unresolved
  return require('@serverless/aws-lambda-sdk');
})();
try {
  serverlessSdk._initialize();
} catch (error) {
  serverlessSdk._reportError(error);
}
const instrument = require('../instrument');

// 2. Initialize original handler
const nodeVersionMajor = Number(process.version.split('.')[0].slice(1));
const isAsyncLoader = nodeVersionMajor >= 16;
const importEsm = (() => {
  if (isAsyncLoader) {
    return async (p) => {
      return await import(p);
    };
  }
  try {
    // eslint-disable-next-line import/no-unresolved
    return require(path.resolve(process.env.LAMBDA_RUNTIME_DIR, 'deasync')).deasyncify(
      async (p) => {
        return await import(p);
      }
    );
  } catch (error) {
    // No ESM support (Node.js v12)
    return null;
  }
})();

const [handlerModuleType, handlerModuleFilename] = [
  handlerModuleInstruction.slice(0, 3),
  handlerModuleInstruction.slice(4),
];
const handlerModule =
  handlerModuleType === 'esm' ? importEsm(handlerModuleFilename) : require(handlerModuleFilename);

// 3. Resolve and instrument handler function
const handlerBasename = path.basename(process.env._HANDLER);
const resolveHandlerNotFoundError = (message) => {
  return Object.assign(new Error(`${handlerBasename} ${message}`), {
    name: 'Runtime.HandlerNotFound',
  });
};
if (handlerModule == null) throw resolveHandlerNotFoundError('is undefined or not exported');

const resolveHandlerObject = (resolvedHandlerModule) => {
  let handlerContext = resolvedHandlerModule;
  if (handlerContext == null) throw resolveHandlerNotFoundError('is undefined or not exported');

  const handlerModuleBasename = handlerBasename.slice(0, handlerBasename.indexOf('.'));

  const handlerPropertyPathTokens = handlerBasename
    .slice(handlerModuleBasename.length + 1)
    .split('.');
  const handlerFunctionName = handlerPropertyPathTokens.pop();
  while (handlerPropertyPathTokens.length) {
    handlerContext = handlerContext[handlerPropertyPathTokens.shift()];
    if (handlerContext == null) throw resolveHandlerNotFoundError('is undefined or not exported');
  }
  const handlerFunction = handlerContext[handlerFunctionName];
  if (handlerFunction == null) throw resolveHandlerNotFoundError('is undefined or not exported');
  if (typeof handlerFunction !== 'function') throw resolveHandlerNotFoundError('is not a function');

  try {
    return { handler: instrument(handlerFunction) };
  } catch (error) {
    serverlessSdk._reportError(error);
    return { handler: handlerFunction };
  }
};

if (isAsyncLoader && typeof handlerModule.then === 'function') {
  module.exports = handlerModule.then(resolveHandlerObject);
  return;
}

module.exports = resolveHandlerObject(handlerModule);
