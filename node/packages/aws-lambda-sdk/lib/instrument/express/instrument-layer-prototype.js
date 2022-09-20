'use strict';

const instrumentedLayers = new WeakMap();

const expressSpansMap = new WeakMap();

const invalidNameCharsPatern = /[^0-9a-zA-Z]/g;
const digitStartRe = /^\d+/;

const generateMiddlewareName = (name) =>
  name.replace(invalidNameCharsPatern, '').replace(digitStartRe, '').toLowerCase();

module.exports.install = (layerPrototype) => {
  if (instrumentedLayers.has(layerPrototype)) return instrumentedLayers.get(layerPrototype);
  const originalHandleRequest = layerPrototype.handle_request;
  const originalHandleError = layerPrototype.handle_error;

  layerPrototype.handle_request = function handle(req, res, next) {
    if (!expressSpansMap.has(req)) {
      const expressSpan = (
        traceSpans.awsLambdaInvocation || traceSpans.awsLambdaInitialization
      ).createSubSpan('express', {
        onCloseByParent: () => {
          process.stderr.write(
            "Serverless SDK Warning: Express route handling didn't end before end of " +
              'lambda invocation (or initialization)\n'
          );
        },
      });
      const expressRouteData = { expressSpan };
      expressSpansMap.set(req, expressRouteData);
      res.on('finish', () => {
        expressSpan.tags.setMany(
          {
            status_code: res.statusCode,
            method: expressRouteData.method?.toUpperCase(),
            path: expressRouteData.route?.path,
          },
          { prefix: 'express' }
        );
        if (!expressSpan.endTime) expressSpan.close();
      });
    }
    const expressRouteData = expressSpansMap.get(req);
    const { expressSpan, routeSpan } = expressRouteData;
    const middlewareSpan = (() => {
      if (routeSpan) {
        return routeSpan.createSubSpan(
          `express.middleware.route.${[
            generateMiddlewareName(this.method),
            generateMiddlewareName(this.name) || 'unknown',
          ]
            .filter(Boolean)
            .join('.')}`
        );
      }
      return expressSpan.createSubSpan(
        `express.middleware.${generateMiddlewareName(this.name) || 'unknown'}`
      );
    })();
    if (this.path && (!expressRouteData.path || expressRouteData.path.length < this.path.length)) {
      expressRouteData.path = this.path;
    }
    if (this.method) expressRouteData.method = this.method;
    if (!routeSpan && this.name === 'bound dispatch') {
      middlewareSpan.name = 'express.middleware.router';
      expressRouteData.routeSpan = middlewareSpan;
      expressRouteData.route = this.route;
    }
    return originalHandleRequest.call(this, req, res, (...args) => {
      if (!middlewareSpan.endTime) {
        middlewareSpan.close();
        if (this.name === 'bound dispatch') delete expressRouteData.routeSpan;
      }
      return next(...args);
    });
  };
  // eslint-disable-next-line camelcase
  layerPrototype.handle_error = function handle_error(error, req, res, next) {
    const { expressSpan, routeSpan } = expressSpansMap.get(req);
    const middlewareSpan = (routeSpan || expressSpan).createSubSpan(
      `express.middleware.error.${generateMiddlewareName(this.name) || 'unknown'}`
    );
    return originalHandleError.call(this, error, req, res, (...args) => {
      if (!middlewareSpan.endTime) middlewareSpan.close();
      return next(...args);
    });
  };

  const uninstall = () => {
    if (!instrumentedLayers.has(layerPrototype)) return;
    layerPrototype.handle_request = originalHandleRequest;
    layerPrototype.handle_error = originalHandleError;
    instrumentedLayers.delete(layerPrototype);
  };
  instrumentedLayers.set(layerPrototype, uninstall);
  return uninstall;
};

module.exports.uninstall = (layerPrototype) => {
  if (!instrumentedLayers.has(layerPrototype)) return;
  instrumentedLayers.get(layerPrototype)();
};

const { traceSpans } = require('../../../');
