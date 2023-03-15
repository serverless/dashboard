#!/usr/bin/env node

'use strict';

require('essentials');
require('../../../lib/flush-logs-on-crash')(require('log-node')());

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
        'init:external:overhead',
        'init:internal:overhead',
        'init:internal:total',
        'init:total',

        'first:internal:request-overhead',
        'first:internal:response-overhead',
        'first:external:response-overhead',
        'first:internal:total',
        'first:total',
        'first:billed',
        'first:local',
        'first:maxMemoryUsed',

        'following:internal:request-overhead',
        'following:internal:response-overhead',
        'following:external:response-overhead',
        'following:internal:total',
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
              Math.round(benchmarkVariantResults.initialization.externalOverhead.average),
              Math.round(benchmarkVariantResults.initialization.internal.overhead.average),
              Math.round(benchmarkVariantResults.initialization.internal.total.average),
              Math.round(benchmarkVariantResults.initialization.total.average),

              Math.round(benchmarkVariantResults.invocation.first.internal.requestOverhead.average),
              Math.round(
                benchmarkVariantResults.invocation.first.internal.responseOverhead.average
              ),
              Math.round(benchmarkVariantResults.invocation.first.externalResponseOverhead.average),
              Math.round(benchmarkVariantResults.invocation.first.internal.total.average),
              Math.round(benchmarkVariantResults.invocation.first.total.average),
              Math.round(benchmarkVariantResults.invocation.first.billed.average),
              Math.round(benchmarkVariantResults.invocation.first.local.average),
              Math.round(benchmarkVariantResults.invocation.first.maxMemoryUsed.average),

              Math.round(
                benchmarkVariantResults.invocation.following.internal.requestOverhead.average
              ),
              Math.round(
                benchmarkVariantResults.invocation.following.internal.responseOverhead.average
              ),
              Math.round(
                benchmarkVariantResults.invocation.following.externalResponseOverhead.average
              ),
              Math.round(benchmarkVariantResults.invocation.following.internal.total.average),
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
