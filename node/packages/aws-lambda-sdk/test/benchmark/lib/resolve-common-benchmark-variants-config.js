'use strict';

module.exports = async (coreConfig, options) => {
  const memorySize = options.memorySize || 1024;
  return new Map([
    [
      'bare',
      {
        configuration: {
          MemorySize: memorySize,
          Layers: [],
          Environment: { Variables: {} },
        },
      },
    ],
    [
      'internal',
      {
        configuration: {
          MemorySize: memorySize,
        },
      },
    ],
    [
      'external',
      {
        configuration: {
          MemorySize: memorySize,
          Layers: [coreConfig.layerExternalArn],
          Environment: {
            Variables: { SLS_SDK_DEBUG: '1' },
          },
        },
      },
    ],
    [
      'internalAndExternal',
      {
        configuration: {
          MemorySize: memorySize,
          Layers: [coreConfig.layerInternalArn, coreConfig.layerExternalArn],
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
              SLS_ORG_ID: process.env.SLS_ORG_ID,
              SLS_DEV_MODE_ORG_ID: process.env.SLS_ORG_ID,
              SLS_SDK_DEBUG: '1',
            },
          },
        },
      },
    ],
  ]);
};
