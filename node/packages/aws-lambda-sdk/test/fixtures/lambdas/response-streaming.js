'use strict';

module.exports.handler = awslambda.streamifyResponse(async (event, responseStream) => {
  responseStream.write('"ok"');
  responseStream.end();
});
