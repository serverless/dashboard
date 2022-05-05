'use strict';

const logMessage = (...args) => {
  if (process.env.DEBUG_SLS_OTEL_LAYER) {
    console.log(...args);
  }
};

const OTEL_SERVER_PORT = 2772;

module.exports = {
  OTEL_SERVER_PORT,
  logMessage,
};
