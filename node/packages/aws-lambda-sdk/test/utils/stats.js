'use strict';

const asc = (arr) => arr.sort((a, b) => a - b);

const quantile = (values, q) => {
  const sorted = asc(values);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const q50 = (values) => quantile(values, 0.5);

module.exports.median = (values) => q50(values);

module.exports.average = (values) => {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
};
