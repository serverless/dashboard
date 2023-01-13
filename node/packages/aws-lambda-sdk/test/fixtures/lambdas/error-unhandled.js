'use strict';

module.exports.handler = () => setTimeout(() => Promise.reject(new Error('Stop')));
