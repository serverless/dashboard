// Otel libraries initialize internally mutliple hooks for `require-in-the-middle`.
// It's highly ineffective as each hook introduces extra decorator over each require call
// and creates new hook instance.
// Same functionality can be achieved with a single hook, and this is what this patch ensures

'use strict';

require('require-in-the-middle');

const requireInTheMiddleModule = require.cache[require.resolve('require-in-the-middle')];
const originalHook = requireInTheMiddleModule.exports;
const hooksMap = new Map();
requireInTheMiddleModule.exports = (modules, options, onrequire) => {
  if (modules.length !== 1) {
    throw new Error('RequireInTheMiddle patch error: Unexpected modules length');
  }
  if (!options.internals) {
    throw new Error('RequireInTheMiddle patch error: Unexpected options');
  }
  if (typeof onrequire !== 'function') {
    throw new Error('RequireInTheMiddle patch error: Missing "onrequire" callback');
  }
  if (hooksMap.has(modules[0])) {
    throw new Error(`RequireInTheMiddle patch error: Duplicate hook for "${modules[0]}"`);
  }
  hooksMap.set(modules[0], onrequire);
};

module.exports = () => {
  originalHook(Array.from(hooksMap.keys()), { internals: true }, (exports, name, baseDir) => {
    if (hooksMap.has(name)) return hooksMap.get(name)(exports, name, baseDir);
    for (const [id, onrequire] of hooksMap) {
      if (name.startsWith(`${id}/`)) return onrequire(exports, name, baseDir);
    }
    throw new Error(`RequireInTheMiddle patch error: Unmatched hook for "${name}"`);
  });
};
