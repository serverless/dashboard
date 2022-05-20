'use strict';

const logMessage = (...args) => {
  if (process.env.DEBUG_SLS_OTEL_LAYER) {
    console.log(...args);
  }
};

module.exports = {
  logMessage,
};
