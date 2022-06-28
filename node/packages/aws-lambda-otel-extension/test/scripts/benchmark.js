#!/usr/bin/env node

'use strict';

require('essentials');
require('log-node')();

const argv = require('yargs-parser')(process.argv.slice(2));

const resolveSet = (comaSeparatedValue) =>
  new Set(
    comaSeparatedValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

require('../benchmark')({
  benchmarkVariants: argv['benchmark-variants'] ? resolveSet(argv['benchmark-variants']) : null,
  useCases: argv['use-cases'] ? resolveSet(argv['use-cases']) : null,
  memorySize: argv['memory-size'] ? Number(argv['memory-size']) : null,
}).then((resultsMap) => {
  process.stdout.write(
    `${[
      [
        'name',
        'init:external',
        'init:internal',
        'init:total',

        'first:internal:request',
        'first:internal:response',
        'first:external',
        'first:total',
        'first:billed',
        'first:local',
        'first:maxMemoryUsed',

        'following:internal:request',
        'following:internal:response',
        'following:external',
        'following:total',
        'following:billed',
        'following:local',
        'following:maxMemoryUsed',
      ]
        .map(JSON.stringify)
        .join('\t'),
      ...Array.from(resultsMap, ([functionVariantName, functionVariantResultsMap]) =>
        Array.from(
          functionVariantResultsMap,
          ([benchmarkVariantName, { results: benchmarkVariantResults }]) =>
            [
              JSON.stringify(`${functionVariantName}:${benchmarkVariantName}`),
              Math.round(benchmarkVariantResults.initialization.external.average),
              Math.round(benchmarkVariantResults.initialization.internal.average),
              Math.round(benchmarkVariantResults.initialization.total.average),

              Math.round(benchmarkVariantResults.invocation.first.internal.request.average),
              Math.round(benchmarkVariantResults.invocation.first.internal.response.average),
              Math.round(benchmarkVariantResults.invocation.first.external.average),
              Math.round(benchmarkVariantResults.invocation.first.total.average),
              Math.round(benchmarkVariantResults.invocation.first.billed.average),
              Math.round(benchmarkVariantResults.invocation.first.local.average),
              Math.round(benchmarkVariantResults.invocation.first.maxMemoryUsed.average),

              Math.round(benchmarkVariantResults.invocation.following.internal.request.average),
              Math.round(benchmarkVariantResults.invocation.following.internal.response.average),
              Math.round(benchmarkVariantResults.invocation.following.external.average),
              Math.round(benchmarkVariantResults.invocation.following.total.average),
              Math.round(benchmarkVariantResults.invocation.following.billed.average),
              Math.round(benchmarkVariantResults.invocation.following.local.average),
              Math.round(benchmarkVariantResults.invocation.following.maxMemoryUsed.average),
            ].join('\t')
        )
      ).flat(),
    ].join('\n')}\n`
  );
});
