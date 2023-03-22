#!/usr/bin/env node

'use strict';

require('essentials');

const argv = require('yargs-parser')(process.argv.slice(2), { boolean: ['runtime-agnostic'] });

require('../lib/build-dummy-dev-mode-extension')(argv._[0], {
  isRuntimeAgnostic: argv['runtime-agnostic'],
});
