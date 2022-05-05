'use strict';

module.exports = () => {
  if (!process.env._HANDLER.includes('.') || process.env._HANDLER.includes('..')) {
    return false; // Bad handler, let error naturally surface
  }

  const path = require('path');
  const handlerDirname = path.dirname(process.env._HANDLER);
  const handlerBasename = path.basename(process.env._HANDLER);
  const handlerModuleBasename = handlerBasename.slice(0, handlerBasename.indexOf('.'));
  const handlerModuleDirname = path.resolve(process.env.LAMBDA_TASK_ROOT, handlerDirname);
  const handlerModuleName = path.resolve(handlerModuleDirname, handlerModuleBasename);

  const importEsm = (() => {
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

  let hasInitializationFailed = false;
  const handlerModule = (() => {
    try {
      if (importEsm) {
        // Handle eventual ESM handler modules
        if (doesModuleExist(`${handlerModuleName}.mjs`)) {
          return importEsm(`${handlerModuleName}.mjs`);
        }
        if (doesModuleExist(`${handlerModuleName}.js`)) {
          if (
            !handlerModuleDirname.endsWith('/node_modules') &&
            (() => {
              try {
                return (
                  require(path.resolve(handlerModuleDirname, 'package.json')).type === 'module'
                );
              } catch {
                return false;
              }
            })()
          ) {
            return importEsm(`${handlerModuleName}.js`);
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

  if (!hasInitializationFailed) {
    const handlerPropertyPathTokens = handlerBasename
      .slice(handlerModuleBasename.length + 1)
      .split('.');
    const handlerFunctionName = handlerPropertyPathTokens.pop();
    let handlerContext = handlerModule;
    if (handlerContext == null) return false;
    while (handlerPropertyPathTokens.length) {
      handlerContext = handlerContext[handlerPropertyPathTokens.shift()];
      if (handlerContext == null) return false;
    }
    const handlerFunction = handlerContext[handlerFunctionName];
    if (typeof handlerFunction !== 'function') return false;

    EvalError.$serverlessHandlerFunction = handlerFunction;
  }

  process.env._ORIGIN_HANDLER = process.env._HANDLER;
  process.env._HANDLER = '/opt/otel-extension/internal/wrapper.handler';

  return true;
};
