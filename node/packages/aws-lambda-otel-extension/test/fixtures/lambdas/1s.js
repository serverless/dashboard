'use strict';

module.exports.handler = (event, context, callback) => {
  setTimeout(
    () =>
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({ result: 'ok', filename: __filename }),
      }),
    1000
  );
};
