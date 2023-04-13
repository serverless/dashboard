'use strict';

const { attemptParseStructuredLogAndCapture } = require('../structured-log-to-event');

const nodeStdout = process.stdout;
const nodeStderr = process.stderr;

let isInstalled = false;
let uninstall;

module.exports.install = () => {
  if (isInstalled) return;
  isInstalled = true;

  const original = {
    stdout: { write: nodeStdout.write },
    stderr: { write: nodeStderr.write },
  };

  nodeStdout.write = function (...args) {
    original.stdout.write.apply(this, args);
    attemptParseStructuredLogAndCapture(args[0]);
  };

  nodeStderr.write = function (...args) {
    original.stderr.write.apply(this, args);
    attemptParseStructuredLogAndCapture(args[0]);
  };

  uninstall = () => {
    nodeStdout.write = original.stdout.write;
    nodeStderr.write = original.stderr.write;
  };
};

module.exports.uninstall = () => {
  if (!isInstalled) return;
  isInstalled = false;
  uninstall();
};
