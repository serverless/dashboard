'use strict';

module.exports.handler = (event, context, callback) => {
  let count = 0;
  const interval = setInterval(() => {
    count += 1;
    console.log(`4s-logger ${count}`);
    if (count === 8) {
      clearInterval(interval);
      callback(null, 'ok');
    }
  }, 500);
};
