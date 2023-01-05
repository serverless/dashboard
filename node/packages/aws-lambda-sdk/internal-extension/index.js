// Resolve original lambda handler in same manner as AWS Node.js runtime does
// store it on global variable, and redirect AWS to rely on Serverless SDK custom handler

'use strict';

try {
  const processStartTime = process.hrtime.bigint();

  if (!process.env._HANDLER.includes('.') || process.env._HANDLER.includes('..')) {
    // Bad handler, let error naturally surface
    return;
  }
  if (!process.env.SLS_ORG_ID) {
    process.stderr.write(
      'Serverless SDK Warning: Cannot instrument function: Missing "SLS_ORG_ID" environment variable\n'
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

  const handlerModuleInstruction = (() => {
    if (nodeVersionMajor > 12) {
      // Handle eventual ESM handler modules
      if (doesModuleExist(`${handlerModuleName}.mjs`)) return `esm@${handlerModuleName}.mjs`;
      if (doesModuleExist(`${handlerModuleName}.js`)) {
        const fs = require('fs');
        let currentDirname = handlerModuleDirname;
        while (!currentDirname.endsWith('/node_modules') && currentDirname !== '/') {
          if (fs.existsSync(path.resolve(currentDirname, 'package.json'))) {
            if (isEsmContext(currentDirname)) return `esm@${handlerModuleName}.js`;
            break;
          }
          currentDirname = path.dirname(currentDirname);
        }
      }
    }

    if (doesModuleExist(handlerModuleName)) return `cjs@${handlerModuleName}`;
    return null;
  })();

  if (!handlerModuleInstruction) return;

  EvalError.$serverlessAwsLambdaInitializationStartTime = processStartTime;
  EvalError.$serverlessHandlerModuleInstruction = handlerModuleInstruction;

  process.env._ORIGIN_HANDLER = process.env._HANDLER;
  process.env._HANDLER = '/opt/sls-sdk-node/wrapper.handler';

  debugLog(
    'Overhead duration: Internal initialization:',
    `${Math.round(Number(process.hrtime.bigint() - processStartTime) / 1000000)}ms`
  );
} catch (error) {
  process._rawDebug(
    'Fatal Serverless SDK Error: ' +
      'Please report at https://github.com/serverless/console/issues: ' +
      'Internal extension setup failed: ',
    error && (error.stack || error)
  );
}
