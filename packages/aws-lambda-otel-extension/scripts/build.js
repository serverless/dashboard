#!/usr/bin/env node

'use strict';

require('essentials');

const path = require('path');

require('./lib/build')(path.resolve(__dirname, '../dist/extension.zip'));
