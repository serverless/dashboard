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
      const expressSpan = serverlessSdk.createTraceSpan('express');
      const openedSpans = new Set();
      const expressRouteData = { expressSpan, openedSpans };
      expressSpansMap.set(req, expressRouteData);
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        if (expressRouteData.route?.path) {
          // Override eventual API Gateway's `resourcePath`
          awsLambdaSpan.tags.delete('aws.lambda.http_router.path');
          awsLambdaSpan.tags.set('aws.lambda.http_router.path', expressRouteData.route.path);
        }
        for (const subSpan of openedSpans) {
          if (!subSpan.endTime) subSpan.close({ endTime });
        }
        openedSpans.clear();
        if (!expressSpan.endTime) expressSpan.close({ endTime });
      });
    }
    const expressRouteData = expressSpansMap.get(req);
    const { routeSpan, openedSpans } = expressRouteData;
    const isRouterMiddleware = !routeSpan && this.name === 'bound dispatch';
    const middlewareSpanName = (() => {
      if (routeSpan) {
        return `express.middleware.route.${[
          generateMiddlewareName(this.method),
          generateMiddlewareName(this.name) || 'unknown',
        ]
          .filter(Boolean)
          .join('.')}`;
      }
      return isRouterMiddleware
        ? 'express.middleware.router'
        : `express.middleware.${generateMiddlewareName(this.name) || 'unknown'}`;
    })();
    const middlewareSpan = serverlessSdk.createTraceSpan(middlewareSpanName);
    openedSpans.add(middlewareSpan);
    if (this.path && (!expressRouteData.path || expressRouteData.path.length < this.path.length)) {
      expressRouteData.path = this.path;
    }
    if (this.method) expressRouteData.method = this.method;
    if (isRouterMiddleware) {
      expressRouteData.routeSpan = middlewareSpan;
      expressRouteData.route = this.route;
    }
    try {
      return originalHandleRequest.call(this, req, res, (...args) => {
        if (!middlewareSpan.endTime) {
          openedSpans.delete(middlewareSpan);
          middlewareSpan.close();
          if (this.name === 'bound dispatch') delete expressRouteData.routeSpan;
        }
        return next(...args);
      });
    } finally {
      middlewareSpan.closeContext();
    }
  };
  // eslint-disable-next-line camelcase
  layerPrototype.handle_error = function handle_error(error, req, res, next) {
    const { openedSpans } = expressSpansMap.get(req);
    const middlewareSpan = serverlessSdk.createTraceSpan(
      `express.middleware.error.${generateMiddlewareName(this.name) || 'unknown'}`
    );
    openedSpans.add(middlewareSpan);
    return originalHandleError.call(this, error, req, res, (...args) => {
      if (!middlewareSpan.endTime) {
        openedSpans.delete(middlewareSpan);
        middlewareSpan.close();
      }
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

const serverlessSdk = global.serverlessSdk || require('../../../');

const awsLambdaSpan = serverlessSdk.traceSpans.awsLambda;
