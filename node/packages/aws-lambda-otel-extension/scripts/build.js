#!/usr/bin/env node

'use strict';

require('essentials');

const argv = require('yargs-parser')(process.argv.slice(2), { coerce: { mode: Number } });

require('./lib/build')(argv._[0], argv);
