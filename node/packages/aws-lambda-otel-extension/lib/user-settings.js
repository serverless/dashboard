// This module is copied as-is into extension layers

'use strict';

const userSettings = (module.exports = {
  logs: {},
  request: {},
  response: {},
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

const altDestination = (() => {
  const setting = process.env.SLS_TEST_EXTENSION_REPORT_DESTINATION || '';
  if (setting.startsWith('s3://')) return setting;
  if (setting === 'log') return setting;
  return null;
})();

if (altDestination) {
  userSettings._altDestination = altDestination;
} else {
  if (!userSettings.ingestToken) throw new Error('Missing required "ingestToken" setting');
  if (!userSettings.orgId) throw new Error('Missing required "orgId" setting');
  if (!userSettings.namespace) throw new Error('Missing required "namespace" setting');
  if (!userSettings.environment) throw new Error('Missing required "environment" setting');
}

const otelResourceAtrributes = [];
if (userSettings.namespace) {
  otelResourceAtrributes.push(`sls_service_name=${userSettings.namespace}`);
}
if (userSettings.environment) otelResourceAtrributes.push(`sls_stage=${userSettings.environment}`);
if (userSettings.orgId) otelResourceAtrributes.push(`sls_org_id=${userSettings.orgId}`);

if (otelResourceAtrributes.length) {
  if (process.env.OTEL_RESOURCE_ATTRIBUTES) {
    process.env.OTEL_RESOURCE_ATTRIBUTES += `,${otelResourceAtrributes.join(',')}`;
  } else {
    process.env.OTEL_RESOURCE_ATTRIBUTES = otelResourceAtrributes.join(',');
  }
}
