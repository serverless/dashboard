'use strict';

const path = require('path');
const readdir = require('fs2/readdir');
const AdmZip = require('adm-zip');
const log = require('log').get('test');

module.exports = async (functionRoot) => {
  log.info('Start creating zip buffer %s', functionRoot);
  const lambdaFiles = await readdir(functionRoot, { depth: Infinity, type: { file: true } });
  const zip = new AdmZip();

  for (const file of lambdaFiles) {
    zip.addLocalFile(path.resolve(functionRoot, file), path.dirname(file));
  }

  try {
    return zip.toBuffer();
  } finally {
    log.info('Zip buffer generated %s', functionRoot);
  }
};
