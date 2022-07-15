#!/usr/bin/env node

'use strict';

const { expect } = require('chai');

const path = require('path');
const runBenchmarks = require('./');

for (const name of [
  'TEST_LAYER_FILENAME',
  'TEST_EXTERNAL_LAYER_FILENAME',
  'TEST_INTERNAL_LAYER_FILENAME',
]) {
  // In tests, current working directory is mocked,
  // so if relative path is provided in env var it won't be resolved properly
  // with this patch we resolve it before cwd mocking
  if (process.env[name]) process.env[name] = path.resolve(process.env[name]);
}

describe('performance', function () {
  this.timeout(120000);

  let results;
  before(async () => {
    const resultsMap = await runBenchmarks({
      benchmarkVariants: new Set(['console']),
      useCases: new Set(['callback']),
      extensionLayersMode:
        process.env.TEST_EXTERNAL_LAYER_FILENAME || process.env.TEST_INTERNAL_LAYER_FILENAME
          ? 'dual'
          : 'single',
    });
    ({ results } = resultsMap.get('callback').get('console'));
  });

  // TODO: Reduce acceptable durations once improvements are made
  it('should introduce reasonable initialization overhead', () => {
    expect(results.initialization.total.median).to.be.below(400);
  });

  it('should introduce reasonable first invocation overhead', () => {
    expect(results.invocation.first.total.median).to.be.below(200);
  });

  it('should introduce reasonable following invocation overhead', () => {
    expect(results.invocation.following.total.median).to.be.below(150);
  });
});
