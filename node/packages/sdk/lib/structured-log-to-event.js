'use strict';

const createErrorCapturedEvent = require('./create-error-captured-event');
const createWarningCapturedEvent = require('./create-warning-captured-event');
const reportError = require('./report-error');

const safeJsonParse = (logLine) => {
  try {
    return JSON.parse(logLine);
  } catch {
    return null;
  }
};

const supportedLevels = new Set(['WARN', 'ERROR']);

const parseLogLevel = (level) => {
  if (typeof level === 'string') {
    const levelUpperCase = level.toUpperCase();
    if (supportedLevels.has(levelUpperCase)) return levelUpperCase;
  } else if (typeof level === 'number') {
    if (level <= 30) return null;
    if (level <= 40) return 'WARN';
    if (level > 40) return 'ERROR';
  }
  return null;
};

const highCardinalityAttributes = [
  'timestamp',
  'xray_trace_id',
  'level',
  'message',
  'msg',
  'time',
  'v',
  'hostname',
  'pid',
];
const pinoKeys = ['time', 'pid', 'hostname'];
const errorObjectKeys = ['message', 'stack'];

const handleErrorLog = (logLineParsed) => {
  // Winston error logs will parse the error into `message` and `stack` keys at the root of the log object.
  const hasWinstonError = errorObjectKeys.every((key) => key in logLineParsed);
  // Pino error logs will parse the error into `err` key at the root of the log object.
  const hasPinoError = 'err' in logLineParsed && pinoKeys.every((key) => key in logLineParsed);

  if (hasWinstonError) {
    const tags = Object.fromEntries(
      Object.entries(logLineParsed)
        .filter(([key]) => ![...highCardinalityAttributes, ...errorObjectKeys].includes(key))
        .filter(([, value]) => !Array.isArray(value) && typeof value !== 'object')
    );

    const err = new Error(logLineParsed.message);
    err.stack = logLineParsed.stack;

    if (logLineParsed.name) {
      err.name = logLineParsed.name;
    }

    createErrorCapturedEvent(err, { tags, _origin: 'nodeConsole' });
  } else if (hasPinoError) {
    const tags = Object.fromEntries(
      Object.entries(logLineParsed)
        .filter(([key]) => ![...highCardinalityAttributes, 'err'].includes(key))
        .filter(([, value]) => !Array.isArray(value) && typeof value !== 'object')
    );

    const err = new Error(logLineParsed.err.message);
    err.stack = logLineParsed.err.stack;

    if (logLineParsed.err.name) {
      err.name = logLineParsed.err.name;
    }

    createErrorCapturedEvent(err, { tags, _origin: 'nodeConsole' });
  } else {
    // In this case we do best attempt at parsing.
    // AWS Lambda Powertools will fall in this category.
    const errorLineData = Object.entries(logLineParsed).find(
      ([, value]) => value && value.message && value.stack
    );
    if (!errorLineData) return;

    const [errKey, errObj] = errorLineData;
    const tags = Object.fromEntries(
      Object.entries(logLineParsed)
        .filter(([key]) => ![...highCardinalityAttributes, errKey].includes(key))
        .filter(([, value]) => !Array.isArray(value) && typeof value !== 'object')
    );

    const err = new Error(errObj.message);
    err.stack = errObj.stack;

    if (errObj.name) {
      err.name = errObj.name;
    }

    createErrorCapturedEvent(err, { tags, _origin: 'nodeConsole' });
  }
};

const handleWarningLog = (logLineParsed) => {
  const msg = logLineParsed.msg || logLineParsed.message;

  const tags = Object.fromEntries(
    Object.entries(logLineParsed)
      .filter(([key]) => !highCardinalityAttributes.includes(key))
      .filter(([, value]) => !Array.isArray(value) && typeof value !== 'object')
  );

  if (msg) {
    createWarningCapturedEvent(msg, { tags, _origin: 'nodeConsole' });
  }
};

module.exports.attemptParseStructuredLogAndCapture = (logLine) => {
  try {
    if (typeof logLine !== 'string') return;
    if (logLine[0] !== '{') return;
    const logLineParsed = safeJsonParse(logLine);
    if (!logLineParsed) return;
    if (!logLineParsed.level) return;
    const logLevel = parseLogLevel(logLineParsed.level);
    switch (logLevel) {
      case 'ERROR':
        handleErrorLog(logLineParsed);
        return;
      case 'WARN':
        handleWarningLog(logLineParsed);
        return;
      case null:
        // If a value is null, it means it is not a valid log line for capturing
        return;
      default:
        throw new Error(`Unsupported log level: ${logLevel}`);
    }
  } catch (error) {
    reportError(error);
  }
};
