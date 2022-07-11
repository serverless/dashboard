#!/usr/bin/env node

'use strict';

require('essentials');
require('log-node')();

const argv = require('yargs-parser')(process.argv.slice(2));

const bucketName = argv.bucketName;
if (!bucketName) throw new Error('--bucket-name param is required');

const layerBasename = argv.layerBasename;
if (!layerBasename) throw new Error('--layer-basenane param is required');

const version = argv.version;
if (!version) throw new Error('--version param is required');

const layerFilename = argv.layerFilename;
if (!layerFilename) throw new Error('--layer-filename param is required');

const fsp = require('fs').promises;
const publishPublicLayers = require('../lib/publish-public-layers');

fsp
  .readFile(layerFilename)
  .then((content) => publishPublicLayers({ bucketName, layerBasename, version, content }));
