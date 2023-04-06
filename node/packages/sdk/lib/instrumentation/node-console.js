'use strict';

const isError = require('type/error/is');
const util = require('util');
const createErrorCapturedEvent = require('../create-error-captured-event');
const createWarningCapturedEvent = require('../create-warning-captured-event');
const reportError = require('../report-error');

const nodeConsole = console;

let isInstalled = false;
let uninstall;

const resolveMessage = (args) => {
  let message = '';
  const argsLength = args.length;
  if (!argsLength) return message;
  message += typeof args[0] === 'string' ? args[0] : util.inspect(args[0]);
  if (argsLength === 1) return message;
  return `${message} ${args
    .slice(1)
    .map((value) => util.inspect(value))
    .join(' ')}`;
};

module.exports.install = () => {
  if (isInstalled) return;
  isInstalled = true;

  const original = { error: nodeConsole.error, warn: nodeConsole.warn };

  nodeConsole.error = function (...args) {
    original.error.apply(this, args);
    try {
      const input = args[0];
      if (
        args.length === 1 &&
        typeof input === 'string' &&
        input.startsWith('{"source":"serverlessSdk",')
      ) {
        return;
      }
      createErrorCapturedEvent(args.length === 1 && isError(input) ? input : resolveMessage(args), {
        _origin: 'nodeConsole',
      });
    } catch (error) {
      reportError(error);
    }
  };

  nodeConsole.warn = function (...args) {
    original.warn.apply(this, args);
    try {
      if (
        args.length === 1 &&
        typeof args[0] === 'string' &&
        args[0].startsWith('{"source":"serverlessSdk",')
      ) {
        return;
      }
      createWarningCapturedEvent(resolveMessage(args), { _origin: 'nodeConsole' });
    } catch (error) {
      reportError(error);
    }
  };

  uninstall = () => {
    nodeConsole.error = original.error;
    nodeConsole.warn = original.warn;
  };
};

module.exports.uninstall = () => {
  if (!isInstalled) return;
  isInstalled = false;
  uninstall();
};
