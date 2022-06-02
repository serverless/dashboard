// Ensure its same as external/otel-extension-external/user-settings.js
// TODO: Possibly centralize this logic assuming convinncing solution is found

'use strict';

module.exports = {
  common: { destination: {} },
  logs: {},
  metrics: { outputType: 'protobuf' },
  request: {},
  response: {},
  traces: { outputType: 'protobuf' },
};

const userSettingsText = process.env.SLS_OTEL_USER_SETTINGS;

if (!userSettingsText) return;

const userSettings = (() => {
  try {
    return JSON.parse(userSettingsText);
  } catch (error) {
    process._rawDebug(`Resolution of user settings failed with: ${error.message}`);
    return null;
  }
})();

if (!userSettings) return;

// Normalize
if (userSettings.common) {
  if (userSettings.common.destination) {
    Object.assign(module.exports.common.destination, userSettings.common.destination);
  }
}

for (const subSettingsName of ['logs', 'metrics', 'request', 'request', 'response', 'traces']) {
  if (userSettings[subSettingsName]) {
    Object.assign(module.exports[subSettingsName], userSettings[subSettingsName]);
  }
}
