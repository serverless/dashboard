// Resolve original lambda handler in same manner as AWS Node.js runtime does
// store it on global variable, and redirect AWS to rely on Serverless SDK custom handler

'use strict';

const processStartTime = process.hrtime.bigint();

if (!process.env._HANDLER.includes('.') || process.env._HANDLER.includes('..')) {
  // Bad handler, let error naturally surface
  return;
}
if (!process.env.SLS_ORG_ID) {
  process.stderr.write(
    'Serverless SDK Error: Cannot instrument function: Missing "SLS_ORG_ID" environment variable\n'
  );
  return;
}

const debugLog = (...args) => {
  if (process.env.SLS_SDK_DEBUG) process._rawDebug('⚡ SDK:', ...args);
};
debugLog('Wrapper initialization');

const path = require('path');

const handlerDirname = path.dirname(process.env._HANDLER);
const handlerBasename = path.basename(process.env._HANDLER);
const handlerModuleBasename = handlerBasename.slice(0, handlerBasename.indexOf('.'));
const handlerModuleDirname = path.resolve(process.env.LAMBDA_TASK_ROOT, handlerDirname);
const handlerModuleName = path.resolve(handlerModuleDirname, handlerModuleBasename);

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

const doesModuleExist = (filename) => {
  try {
    require.resolve(filename);
    return true;
  } catch {
    return false;
  }
};

const isEsmContext = (dirname) => {
  try {
    return require(path.resolve(dirname, 'package.json')).type === 'module';
  } catch {
    return false;
  }
};

EvalError.$serverlessAwsLambdaInitializationStartTime = processStartTime;
global.serverlessSdk = require('../');

let hasInitializationFailed = false;
const startTime = process.hrtime.bigint();

const handlerModule = (() => {
  try {
    if (importEsm) {
      // Handle eventual ESM handler modules
      if (doesModuleExist(`${handlerModuleName}.mjs`)) {
        return importEsm(`${handlerModuleName}.mjs`);
      }
      if (doesModuleExist(`${handlerModuleName}.js`)) {
        const fs = require('fs');
        let currentDirname = handlerModuleDirname;
        while (!currentDirname.endsWith('/node_modules') && currentDirname !== '/') {
          if (fs.existsSync(path.resolve(currentDirname, 'package.json'))) {
            if (isEsmContext(currentDirname)) return importEsm(`${handlerModuleName}.js`);
            break;
          }
          currentDirname = path.dirname(currentDirname);
        }
      }
    }

    if (doesModuleExist(handlerModuleName)) return require(handlerModuleName);
    return require('module').createRequire(handlerModuleName)(handlerModuleBasename);
  } catch (error) {
    hasInitializationFailed = true;
    EvalError.$serverlessHandlerModuleInitializationError = error;
    return null;
  }
})();
const handlerLoadDuration = process.hrtime.bigint() - startTime;

if (!hasInitializationFailed) {
  let handlerContext = handlerModule;
  if (handlerContext == null) return;

  if (isAsyncLoader && typeof handlerContext.then === 'function') {
    EvalError.$serverlessHandlerDeferred = handlerContext;
  } else {
    const handlerPropertyPathTokens = handlerBasename
      .slice(handlerModuleBasename.length + 1)
      .split('.');
    const handlerFunctionName = handlerPropertyPathTokens.pop();
    while (handlerPropertyPathTokens.length) {
      handlerContext = handlerContext[handlerPropertyPathTokens.shift()];
      if (handlerContext == null) return;
    }
    const handlerFunction = handlerContext[handlerFunctionName];
    if (typeof handlerFunction !== 'function') return;

    EvalError.$serverlessHandlerFunction = handlerFunction;
  }
}

process.env._ORIGIN_HANDLER = process.env._HANDLER;
process.env._HANDLER = '/opt/sls-sdk-node/wrapper.handler';

debugLog(
  'Overhead duration: Internal initialization:',
  `${Math.round(
    Number(process.hrtime.bigint() - processStartTime - handlerLoadDuration) / 1000000
  )}ms`
);
