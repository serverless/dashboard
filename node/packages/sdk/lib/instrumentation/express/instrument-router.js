'use strict';

const reportError = require('../../report-error');
const instrumentLayerPrototype = require('./instrument-layer-prototype');

const instrumentedRouters = new WeakMap();

module.exports.install = (routerPrototype) => {
  if (instrumentedRouters.has(routerPrototype)) return instrumentedRouters.get(routerPrototype);

  const originalUse = routerPrototype.use;
  const originalRoute = routerPrototype.route;

  routerPrototype.use = function use(fn) {
    const initLength = this.stack.length;
    try {
      // eslint-disable-next-line prefer-rest-params
      return originalUse.apply(this, arguments);
    } finally {
      if (this.stack[0]) instrumentLayerPrototype.install(Object.getPrototypeOf(this.stack[0]));
      if (typeof fn === 'string') {
        try {
          for (let i = initLength; i < this.stack.length; i++) {
            const layer = this.stack[i];
            layer.$slsRoutePath = fn;
          }
        } catch (error) {
          reportError(error);
        }
      }
    }
  };

  routerPrototype.route = function route(path) {
    const initLength = this.stack.length;
    try {
      // eslint-disable-next-line prefer-rest-params
      return originalRoute.apply(this, arguments);
    } finally {
      if (this.stack[0]) instrumentLayerPrototype.install(Object.getPrototypeOf(this.stack[0]));
      try {
        for (let i = initLength; i < this.stack.length; i++) {
          const layer = this.stack[i];
          layer.$slsRoutePath = path;
        }
      } catch (error) {
        reportError(error);
      }
    }
  };

  const uninstall = () => {
    if (!instrumentedRouters.has(routerPrototype)) return;
    routerPrototype.use = originalUse;
    routerPrototype.route = originalRoute;
    instrumentedRouters.delete(routerPrototype);
  };
  instrumentedRouters.set(routerPrototype, uninstall);
  return uninstall;
};

module.exports.uninstall = (routerPrototype) => {
  if (!instrumentedRouters.has(routerPrototype)) return;
  instrumentedRouters.get(routerPrototype)();
};
