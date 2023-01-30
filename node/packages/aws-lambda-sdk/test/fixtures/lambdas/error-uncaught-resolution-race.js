'use strict';

module.exports.handler = () => {
  let resolve;
  const promise = new Promise((_resolve) => {
    resolve = _resolve;
  });
  process.nextTick(() => {
    resolve();
    throw new Error('Stop');
  });
  return promise;
};
