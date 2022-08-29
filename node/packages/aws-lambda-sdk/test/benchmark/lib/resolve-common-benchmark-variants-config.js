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
  ]);
};
