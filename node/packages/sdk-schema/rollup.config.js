import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import multi from '@rollup/plugin-multi-entry';
import dts from 'rollup-plugin-dts';
import fg from 'fast-glob';

const getInputFiles = () => {
  const inputFiles = fg.sync('out/serverless/**/*.ts');
  return inputFiles.map((input) => ({
    input,
    outputFile: input.replace('out/serverless/proto/', 'dist/').replace('.ts', '.js'),
  }));
};

const inputFiles = getInputFiles();

export default [
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
