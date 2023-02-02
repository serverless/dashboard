'use strict';

module.exports = (message, code) => {
  console.warn({
    source: 'serverlessSdk',
    message,
    code,
  });
};
