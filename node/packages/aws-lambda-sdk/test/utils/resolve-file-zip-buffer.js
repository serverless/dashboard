'use strict';

const AdmZip = require('adm-zip');
const memoizee = require('memoizee');
const log = require('log').get('test');

module.exports = memoizee(
  (filename) => {
    log.info('Start creating zip buffer %s', filename);
    const zip = new AdmZip();

    zip.addLocalFile(filename);

    try {
      return zip.toBuffer();
    } finally {
      log.info('Zip buffer generated %s', filename);
    }
  },
  { primitive: true }
);
