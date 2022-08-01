'use strict';

module.exports.handler = () =>
  setTimeout(() => {
    /* never happens */
  }, 2147483647);
