'use strict';

const diff = BigInt(Date.now()) * BigInt(1000000) - process.hrtime.bigint();

module.exports = (uptimeTimestamp) => String(uptimeTimestamp + diff);
