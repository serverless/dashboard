'use strict';

const typescript = require('@rollup/plugin-typescript');
const pkg = require('./package.json');
const multi = require('@rollup/plugin-multi-entry');
const { default: dts } = require('rollup-plugin-dts');
const fg = require('fast-glob');

const getInputFiles = () => {
  const inputFiles = fg.sync('out/serverless/**/*.ts');
  return inputFiles.map((input) => ({
    input,
    outputFile: input
      .replace('out/serverless/', 'dist/')
      .replace('.ts', '.js')
      .replace('v1/', '')
      .replace('instrumentation/', ''),
  }));
};

const inputFiles = getInputFiles();

module.exports = [
  ...inputFiles.map(({ input, outputFile }) => ({
    input,
    output: {
      file: outputFile,
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: 'tsconfig.rollup.json',
      }),
    ],
  })),
  {
    input: 'out/serverless/**/*.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: 'tsconfig.rollup.json',
      }),
      multi(),
    ],
  },
  {
    input: 'dist/dts/**/*.d.ts',
    output: [
      {
        file: pkg.types,
        format: 'es',
      },
    ],
    plugins: [multi(), dts()],
  },
];
