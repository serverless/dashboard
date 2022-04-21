'use strict';

const settingsJsonString = process.env.SLS_OTEL_USER_SETTINGS;

if (!settingsJsonString) return;

try {
  module.exports = JSON.parse(settingsJsonString);
} catch (error) {
  process.stdout.write(`Resolution of user settings failed with: ${error.message}`);
}
