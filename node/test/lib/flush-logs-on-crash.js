'use strict';

module.exports = (logWriter) => {
  if (process.env.LOG_LEVEL || process.env.LOG_DEBUG || process.env.DEBUG) return;

  const logEmitter = require('log/lib/emitter');

  const logsBuffer = [];
  const flushLogs = () => {
    logsBuffer.forEach((event) => {
      if (!event.message) logWriter.resolveMessage(event);
      logWriter.writeMessage(event);
    });
    logsBuffer.length = 0; // Empty array
  };

  logEmitter.on('log', (event) => {
    logsBuffer.push(event);
    if (!event.message) logWriter.resolveMessageTokens(event);
  });

  process.on('exit', () => {
    if (process.exitCode) {
      process.stderr.write('\n\nALL GATHERED LOGS:\n');
      flushLogs();
    }
  });
};
