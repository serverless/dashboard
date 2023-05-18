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
    try {
      attemptParseStructuredLogAndCapture(args[0]);
    } catch (error) {
      process.nextTick(() => {
        // Prevent crashes swalling by Node.js console
        // see: https://github.com/nodejs/node/blob/3538e1bcde45eae60c6bdbedeb3f765dbb9714c2/lib/internal/console/constructor.js#L306-L310
        throw error;
      });
    }
  };

  nodeStderr.write = function (...args) {
    original.stderr.write.apply(this, args);
    try {
      attemptParseStructuredLogAndCapture(args[0]);
    } catch (error) {
      process.nextTick(() => {
        // Prevent crashes swalling by Node.js console
        // see: https://github.com/nodejs/node/blob/3538e1bcde45eae60c6bdbedeb3f765dbb9714c2/lib/internal/console/constructor.js#L306-L310
        throw error;
      });
    }
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
