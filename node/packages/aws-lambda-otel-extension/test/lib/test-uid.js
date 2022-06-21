'use strict';

const { machineIdSync: getMachineId } = require('node-machine-id');
const log = require('log').get('test');

const nameTimeBase = new Date(2022, 1, 17).getTime();

const testUid = (() => {
  if (process.env.TEST_UID) return process.env.TEST_UID;
  switch (process.env.TEST_UID_MODE || (process.env.CI ? 'run' : 'machine')) {
    case 'run':
      return (Date.now() - nameTimeBase).toString(32);
    default:
      return getMachineId(true).split('-')[1];
  }
})();

log.notice('test uid: %s', testUid);

module.exports = testUid;
