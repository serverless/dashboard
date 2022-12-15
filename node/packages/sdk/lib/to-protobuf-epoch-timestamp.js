'use strict';

const toLong = require('./to-long');
const resolveEpochTimestampString = require('./resolve-epoch-timestamp-string');

module.exports = (uptimeTimestamp) => toLong(resolveEpochTimestampString(uptimeTimestamp));
