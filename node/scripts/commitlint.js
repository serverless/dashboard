#!/usr/bin/env node

// Temporary workaround for commitlint limitations:
// See: https://github.com/conventional-changelog/commitlint/issues/3104
// TODO: Remove once above issue is addressed

'use strict';

require('essentials');

const chalk = require('chalk');

if (!process.argv[2]) {
  process.stdout.write(chalk.red('Path must be provided\n'));
  process.exit(1);
}

if (!process.argv[3]) {
  process.stdout.write(chalk.red('Range must be provided\n'));
  process.exit(1);
}

const path = require('path');
const spawn = require('child-process-ext/spawn');
const lint = require('@commitlint/lint').default;

const { rules } = require(path.resolve(__dirname, '..', process.argv[2], 'commitlint.config'));

(async () => {
  const separator = '------------------------ >8 -----------------------';
  const messages = String(
    (
      await spawn(
        'git',
        ['log', `--format=%B%n${separator}`, process.argv[3], '--', process.argv[2]],
        {
          cwd: path.resolve(__dirname, '..'),
        }
      )
    ).stdBuffer
  )
    .split(separator)
    .map((message) => message.trim())
    .filter(Boolean);
  const errors = new Map();
  await Promise.all(
    messages.map(async (message) => {
      const result = await lint(message, rules);
      if (!result.errors.length && !result.warnings.length) return;
      const errorMessages = new Set();
      errors.set(message, errorMessages);
      for (const { message: errorMessage } of [...result.errors, ...result.warnings]) {
        errorMessages.add(errorMessage);
      }
    })
  );
  if (!errors.size) return;
  process.exitCode = 1;
  for (const [message, errorMessages] of errors) {
    process.stdout.write(`${chalk.bold(message)}\n`);
    for (const errorMessage of errorMessages) {
      process.stdout.write(`${chalk.red(errorMessage)}\n`);
    }
    process.stdout.write('\n');
  }
})();
