'use strict';

const resolveStackString = (error) => {
  if (!error) return null;
  if (typeof error.stack !== 'string') return null;
  const firstLineIndex = error.stack.search(/\n\s+at\s/);
  if (firstLineIndex === -1) return null;
  return error.stack
    .slice(firstLineIndex + 1)
    .split('\n')
    .map((str) => str.trim())
    .join('\n');
};

module.exports = (error = null) => {
  const inputStack = resolveStackString(error);
  if (inputStack) return inputStack;
  return resolveStackString(new Error()).split('\n').slice(3).join('\n');
};
