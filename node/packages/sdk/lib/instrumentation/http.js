'use strict';

const { searchParamsSymbol } = require('url');
const { errorMonitor } = require('events');
const reportError = require('../report-error');

let shouldIgnoreFollowingRequest = false;

const requestFilters = [];

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
  const bodySizeLimit = serverlessSdk._maximumBodyByteLength;
  const shouldMonitorRequestResponse =
    serverlessSdk._isDevMode && !serverlessSdk._settings.disableRequestResponseMonitoring;

  const captureRequestBody = (traceSpan, req) => {
    let isCapturing = true;
    let body = '';
    const originalWrite = req.write;
    const originalEnd = req.end;
    const abortCapture = () => {
      isCapturing = false;
      req.write = originalWrite;
      req.end = originalEnd;
      body = null;
    };
    req.write = function write(chunk, encoding, callback) {
      try {
        if (isCapturing) {
          if (typeof chunk === 'string') {
            body += chunk;
            if (Buffer.byteLength(body) > bodySizeLimit) {
              serverlessSdk._reportNotice('Large body excluded', 'INPUT_BODY_TOO_LARGE', {
                _traceSpan: traceSpan,
              });
              abortCapture();
            }
          } else {
            abortCapture();
          }
        }
      } catch (error) {
        reportError(error);
      }
      return originalWrite.call(this, chunk, encoding, callback);
    };
    req.end = function end(chunk, encoding, callback) {
      try {
        if (isCapturing) {
          if (typeof chunk === 'string') {
            body += chunk;
            if (Buffer.byteLength(body) > bodySizeLimit) {
              serverlessSdk._reportNotice('Large body excluded', 'INPUT_BODY_TOO_LARGE', {
                _traceSpan: traceSpan,
              });
              abortCapture();
            }
          } else if (chunk) {
            abortCapture();
          }
          if (body) traceSpan.input = body;
          abortCapture();
        }
      } catch (error) {
        reportError(error);
      }
      return originalEnd.call(this, chunk, encoding, callback);
    };
  };

  const captureResponseBody = (traceSpan, response) => {
    const originalAddListener = response.addListener;
    let isAttached = false;

    response.addListener = response.on = function addListener(type, listener) {
      if (!isAttached && type === 'data') {
        isAttached = true;
        response.addListener = response.on = originalAddListener;
        let bodyBuffer = Buffer.from('');
        response.on('data', (chunk) => {
          try {
            if (!bodyBuffer) return;
            bodyBuffer = Buffer.concat([
              bodyBuffer,
              typeof chunk === 'string' ? Buffer.from(chunk) : chunk,
            ]);
            if (bodyBuffer.length > bodySizeLimit) {
              serverlessSdk._reportNotice('Large body excluded', 'OUTPUT_BODY_TOO_LARGE', {
                _traceSpan: traceSpan,
              });
              bodyBuffer = null;
            }
          } catch (error) {
            reportError(error);
          }
        });
        response.on('end', () => {
          try {
            const body = (() => {
              if (!bodyBuffer || !bodyBuffer.length) return null;
              try {
                return new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer);
              } catch {
                return null;
              }
            })();
            if (body) traceSpan.output = body;
          } catch (error) {
            reportError(error);
          }
        });
      }
      return originalAddListener.call(this, type, listener);
    };
  };

  const originalRequest = httpModule.request;
  const originalGet = httpModule.get;

  const request = function request(...args) {
    const startTime = process.hrtime.bigint();
    let [url, options] = args;

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
      options = { ...url };
    } else {
      options = { ...url, ...options };
    }
    if (options.path) {
      try {
        const resolvedUrl = new URL(options.path, 'http://localhost');
        options.pathname = resolvedUrl.pathname;
        options.search = resolvedUrl.search;
      } catch {
        shouldIgnoreFollowingRequest = false;
        return originalRequest.apply(this, args);
      }
    }

    const originalCb = args[cbIndex];
    if (
      shouldIgnoreFollowingRequest ||
      options._slsIgnore ||
      (originalCb && typeof originalCb !== 'function') ||
      serverlessSdk._isInTraceSpanBlackBox ||
      requestFilters.some((filter) => !filter(options))
    ) {
      shouldIgnoreFollowingRequest = false;
      return originalRequest.apply(this, args);
    }

    let requestEndTime;
    let responseReadableState;
    args.splice(cbIndex, 1, (response) => {
      requestEndTime = process.hrtime.bigint();
      responseReadableState = response._readableState;
      traceSpan.tags.set('http.status_code', response.statusCode);
      if (shouldMonitorRequestResponse) captureResponseBody(traceSpan, response);
      response.on('end', () => {
        if (!traceSpan.endTime) traceSpan.close();
      });
      if (originalCb) originalCb(response);
    });

    const traceSpan = serverlessSdk._createTraceSpan(`node.${protocol}.request`, {
      startTime,
      onCloseByRoot: () => {
        if (responseReadableState && !responseReadableState.flowing) {
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

    if (shouldMonitorRequestResponse) captureRequestBody(traceSpan, req);

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
  if (!isInstalled) return;
  shouldIgnoreFollowingRequest = true;
  process.nextTick(() => {
    shouldIgnoreFollowingRequest = false;
  });
};

module.exports.requestFilters = requestFilters;

const serverlessSdk = require('../..');
