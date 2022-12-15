'use strict';

const crypto = require('crypto');

module.exports = () => crypto.randomBytes(16).toString('hex');
