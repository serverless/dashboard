'use strict';

const reportError = require('../../report-error');

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
    let middlewareSpan;
    let expressRouteData;
    let isRouterMiddleware;
    try {
      if (!expressSpansMap.has(req)) {
        const expressSpan = serverlessSdk._createTraceSpan('express');
        const openedSpans = new Set();
        expressRouteData = { expressSpan, openedSpans };
        expressSpansMap.set(req, expressRouteData);
        res.on('finish', () => {
          const endTime = process.hrtime.bigint();
          const rootSpan = serverlessSdk.traceSpans.root;
          if (rootSpan && expressRouteData.path) {
            // Override eventual API Gateway's `resourcePath`
            rootSpan.tags.delete('aws.lambda.http_router.path');
            rootSpan.tags.set('aws.lambda.http_router.path', expressRouteData.path);
          }
          for (const subSpan of openedSpans) {
            if (!subSpan.endTime) subSpan.close({ endTime });
          }
          openedSpans.clear();
          if (!expressSpan.endTime) expressSpan.close({ endTime });
        });
      }
      expressRouteData = expressSpansMap.get(req);
      const { routeSpan, openedSpans } = expressRouteData;
      isRouterMiddleware = Boolean(!routeSpan && this.route);
      const middlewareSpanName = (() => {
        if (routeSpan) {
          return `express.middleware.route.${[
            // TODO: Cover not set `this.method` case with integration test
            // (at this point it's not clear how to reproduce it)
            this.method && generateMiddlewareName(this.method),
            generateMiddlewareName(this.name) || 'unknown',
          ]
            .filter(Boolean)
            .join('.')}`;
        }
        if (isRouterMiddleware) return 'express.middleware.router';
        if (this.name === 'router' && this.path) {
          return `express.middleware.router.${
            generateMiddlewareName(this.$slsRoutePath || '') || 'unknown'
          }`;
        }
        return `express.middleware.${generateMiddlewareName(this.name) || 'unknown'}`;
      })();
      middlewareSpan = serverlessSdk._createTraceSpan(middlewareSpanName);
      openedSpans.add(middlewareSpan);
      if (this.path) {
        if (isRouterMiddleware) {
          expressRouteData.path = (expressRouteData.nestedPath || '') + (this.$slsRoutePath || '');
        } else {
          expressRouteData.nestedPath =
            (expressRouteData.nestedPath || '') + (this.$slsRoutePath || '');
        }
      }
      if (this.method) expressRouteData.method = this.method;
      if (isRouterMiddleware) expressRouteData.routeSpan = middlewareSpan;
    } catch (error) {
      reportError(error);
      return originalHandleRequest.call(this, req, res, next);
    }
    try {
      return originalHandleRequest.call(this, req, res, (...args) => {
        try {
          if (!middlewareSpan.endTime) {
            expressRouteData.openedSpans.delete(middlewareSpan);
            middlewareSpan.close();
            if (isRouterMiddleware) delete expressRouteData.routeSpan;
          }
        } catch (error) {
          reportError(error);
        }
        return next(...args);
      });
    } finally {
      middlewareSpan.closeContext();
    }
  };
  // eslint-disable-next-line camelcase
  layerPrototype.handle_error = function handle_error(error, req, res, next) {
    const expressRouteData = expressSpansMap.get(req);
    let middlewareSpan;
    try {
      const { openedSpans } = expressRouteData;
      middlewareSpan = serverlessSdk._createTraceSpan(
        `express.middleware.error.${generateMiddlewareName(this.name) || 'unknown'}`
      );
      openedSpans.add(middlewareSpan);
    } catch (sdkError) {
      reportError(sdkError);
      return originalHandleError.call(this, error, req, res, next);
    }
    return originalHandleError.call(this, error, req, res, (...args) => {
      if (!middlewareSpan.endTime) {
        expressRouteData.openedSpans.delete(middlewareSpan);
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

const serverlessSdk = require('../../..');
