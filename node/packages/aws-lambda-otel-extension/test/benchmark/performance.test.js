#!/usr/bin/env node

'use strict';

const { expect } = require('chai');

const runBenchmarks = require('./');

describe('performance', function () {
  this.timeout(120000);

  let results;
  before(async () => {
    const resultsMap = await runBenchmarks({
      benchmarkVariants: new Set(['console']),
      useCases: new Set(['callback']),
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
