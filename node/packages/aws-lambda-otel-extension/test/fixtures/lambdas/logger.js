'use strict';

module.exports.handler = (event, context, callback) => {
  let counter = 1000;
  const interval = setInterval(() => {
    console.log(counter);
    if (!--counter) {
      clearInterval(interval);
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({ result: 'ok', filename: __filename }),
      });
    }
  }, 1);
};
