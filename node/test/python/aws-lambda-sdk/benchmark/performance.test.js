#!/usr/bin/env node

'use strict';

const { expect } = require('chai');

const runBenchmarks = require('./');

describe('performance', function () {
  this.timeout(120000);

  let results;
  before(async () => {
    const resultsMap = await runBenchmarks({
      benchmarkVariants: new Set(['internal']),
      useCases: new Set(['success']),
    });
    results = resultsMap.get('success');
  });

  // TODO: Reduce acceptable durations once improvements are made
  it('should introduce reasonable initialization overhead', () => {
    expect(results.get('internal').results.initialization.total.median).to.be.below(260);
  });

  it('should introduce reasonable first invocation overhead', () => {
    expect(results.get('internal').results.invocation.first.total.median).to.be.below(15);
  });

  it('should introduce reasonable following invocation overhead', () => {
    expect(results.get('internal').results.invocation.following.total.median).to.be.below(10);
  });
});
