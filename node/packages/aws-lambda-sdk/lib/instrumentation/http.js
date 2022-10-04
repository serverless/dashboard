'use strict';

const { searchParamsSymbol } = require('url');
const { errorMonitor } = require('events');

let shouldIgnoreFollowingRequest = false;

const urlToHttpOptions = (url) => {
  const options = {
    hostname:
      typeof url.hostname === 'string' && url.hostname.startsWith('[')
        ? url.hostname.slice(1, -1)
        : url.hostname,
    search: url.search,
    pathname: url.pathname,
  };
  if (url.port !== '') options.port = Number(url.port);
  return options;
};

const resolveMethod = (options) => {
  if (options.method == null) return 'GET';
  if (typeof options.method === 'string') return options.method.toUpperCase();
  return null;
};

const resolveQueryParamNamesFromSearchString = (searchString) => {
  const result = [];
  if (searchString) {
    for (const [paramName] of new URLSearchParams(searchString)) result.push(paramName);
  }
  return result;
};

const install = (protocol, httpModule) => {
  const originalRequest = httpModule.request;
  const originalGet = httpModule.get;

  const request = function request(url, options, cb) {
    const startTime = process.hrtime.bigint();
    serverlessSdk._debugLog('HTTP request', shouldIgnoreFollowingRequest, new Error().stack);
    const args = [url, options, cb];

    let cbIndex = 2;
    if (typeof url === 'string') {
      url = urlToHttpOptions(new URL(url));
    } else if (url && url[searchParamsSymbol] && url[searchParamsSymbol][searchParamsSymbol]) {
      url = urlToHttpOptions(url);
    } else {
      cbIndex = 1;
      options = url;
      url = null;
    }

    if (typeof options === 'function') {
      --cbIndex;
      options = url || {};
    } else {
      options = Object.assign(url || {}, options);
    }
    if (shouldIgnoreFollowingRequest || options._slsIgnore) {
      shouldIgnoreFollowingRequest = false;
      return originalRequest.apply(this, args);
    }

    const originalCb = args[cbIndex];
    if (originalCb && typeof originalCb !== 'function') {
      throw new TypeError('The "listener" argument must be of type function');
    }
    let requestEndTime;
    let responseReadableState;
    args.splice(cbIndex, 1, (response) => {
      requestEndTime = process.hrtime.bigint();
      responseReadableState = response._readableState;
      traceSpan.tags.set('http.status_code', response.statusCode);
      response.on('end', () => {
        if (!traceSpan.endTime) traceSpan.close();
      });
      if (originalCb) originalCb(response);
    });

    const traceSpan = serverlessSdk.createTraceSpan(`node.${protocol}.request`, {
      startTime,
      onCloseByRoot: () => {
        if (responseReadableState?.flowing === false) {
          // Response data was not observed
          traceSpan.close({ endTime: requestEndTime });
          return;
        }
        traceSpan.tags.set('http.error_code', 'EXECUTION_CONTEXT_OVERFLOW');
      },
    });

    let req;
    try {
      req = originalRequest.apply(this, args);
    } catch (error) {
      traceSpan.destroy();
      throw error;
    }
    traceSpan.closeContext();
    traceSpan.tags.setMany(
      {
        method: resolveMethod(options),
        protocol: 'HTTP/1.1',
        host: options.hostname
          ? options.hostname + (options.port ? `:${options.port}` : '')
          : options.host || 'localhost',
        path: options.pathname || '/',
        request_header_names: Object.keys(options.headers || {}),
        query_parameter_names: resolveQueryParamNamesFromSearchString(options.search),
      },
      { prefix: 'http' }
    );

    return req.on(errorMonitor, (error) => {
      if (traceSpan.endTime) return;
      traceSpan.tags.set('http.error_code', error.code || 'UNKNOWN');
      traceSpan.close();
    });
  };

  httpModule.request = request;
  httpModule.get = function get(input, options, cb) {
    return request(input, options, cb).end();
  };

  return () => {
    httpModule.request = originalRequest;
    httpModule.get = originalGet;
  };
};

let isInstalled = false;
let uninstallHttp;
let uninstallHttps;

module.exports.uninstall = () => {
  if (!isInstalled) return;
  isInstalled = false;
  uninstallHttp();
  uninstallHttps();
};
module.exports.install = () => {
  if (isInstalled) return;
  isInstalled = true;

  uninstallHttp = install('http', require('http'));
  uninstallHttps = install('https', require('https'));
};

module.exports.ignoreFollowingRequest = () => {
  serverlessSdk._debugLog('ignore HTTP request', shouldIgnoreFollowingRequest, new Error().stack);
  shouldIgnoreFollowingRequest = true;
  process.nextTick(() => {
    serverlessSdk._debugLog('reset ignore HTTP request', shouldIgnoreFollowingRequest);
    shouldIgnoreFollowingRequest = false;
  });
};

const serverlessSdk = global.serverlessSdk || require('../../');
