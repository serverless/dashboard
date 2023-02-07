'use strict';

const path = require('path');
const readdir = require('fs2/readdir');
const AdmZip = require('adm-zip');
const memoizee = require('memoizee');
const log = require('log').get('test');

module.exports = memoizee(
  async (functionRoot, options = {}) => {
    log.info('Start creating zip buffer %s', functionRoot);
    const lambdaFiles = await readdir(functionRoot, { depth: Infinity, type: { file: true } });
    const zip = new AdmZip();

    for (const file of lambdaFiles) {
      zip.addLocalFile(
        path.resolve(functionRoot, file),
        path.join(options.dirname || '', path.dirname(file))
      );
    }

    try {
      return zip.toBuffer();
    } finally {
      log.info('Zip buffer generated %s', functionRoot);
    }
  },
  { primitive: true, promise: true }
);
