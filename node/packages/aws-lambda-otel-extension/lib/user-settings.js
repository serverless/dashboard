// This module is copied as-is into extension layers

'use strict';

const userSettings = (module.exports = {
  common: { destination: {} },
  logs: {},
  metrics: {},
  request: {},
  response: {},
  traces: {},
});

const isObject = (value) => Boolean(value && typeof value === 'object');

const merge = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (isObject(value)) {
      if (!isObject(target[key])) target[key] = {};
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
};

const bundledSettings = (() => {
  try {
    require.resolve('./.user-settings');
  } catch {
    return null;
  }
  // eslint-disable-next-line import/no-unresolved
  return require('./.user-settings');
})();

if (bundledSettings) merge(userSettings, bundledSettings);

const envSettingsText = process.env.SLS_OTEL_USER_SETTINGS;
if (envSettingsText) merge(userSettings, JSON.parse(envSettingsText));
