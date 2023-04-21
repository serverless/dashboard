'use strict';

const isObject = require('type/object/is');
const createErrorCapturedEvent = require('./create-error-captured-event');
const createWarningCapturedEvent = require('./create-warning-captured-event');

const parseLogLevel = (level) => {
  if (typeof level === 'string') {
    const levelUpperCase = level.toUpperCase();
    if (levelUpperCase !== 'ERROR' && levelUpperCase !== 'WARN') {
      throw new Error('Unsupported level');
    }
    return levelUpperCase;
  } else if (typeof level === 'number') {
    if (level <= 30) {
      throw new Error('Unsupported level');
    }

    if (level <= 40) {
      return 'WARN';
    }
    return 'ERROR';
  }
  throw new Error('Unsupported level');
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
    const [errKey, errObj] = Object.entries(logLineParsed).find(
      ([, value]) => isObject(value) && 'message' in value && 'stack' in value
    );

    if (!errKey || !errObj) {
      return;
    }
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
    const logLineParsed = JSON.parse(logLine.toString());
    if ('level' in logLineParsed) {
      const logLevel = parseLogLevel(logLineParsed.level);
      if (logLevel === 'ERROR') {
        handleErrorLog(logLineParsed);
      } else if (logLevel === 'WARN') {
        handleWarningLog(logLineParsed);
      }
    }
  } catch (err) {
    // Not a structured logline
  }
};
