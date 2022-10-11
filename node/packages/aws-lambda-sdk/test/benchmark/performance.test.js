#!/usr/bin/env node

'use strict';

const { expect } = require('chai');

const runBenchmarks = require('./');

describe('performance', function () {
  this.timeout(120000);

  let results;
  before(async () => {
    const resultsMap = await runBenchmarks({
      benchmarkVariants: new Set(['internal', 'internalAndExternal']),
      useCases: new Set(['callback']),
    });
    results = resultsMap.get('callback');
  });

  // TODO: Reduce acceptable durations once improvements are made
  it('should introduce reasonable initialization overhead', () => {
    expect(results.get('internal').results.initialization.total.median).to.be.below(250);
    expect(results.get('internalAndExternal').results.initialization.total.median).to.be.below(310);
  });

  it('should introduce reasonable first invocation overhead', () => {
    expect(results.get('internal').results.invocation.first.total.median).to.be.below(11);
    expect(results.get('internalAndExternal').results.invocation.first.total.median).to.be.below(
      35
    );
  });

  it('should introduce reasonable following invocation overhead', () => {
    expect(results.get('internal').results.invocation.following.total.median).to.be.below(10);
    expect(results.get('internalAndExternal').results.invocation.first.total.median).to.be.below(
      35
    );
  });
});
