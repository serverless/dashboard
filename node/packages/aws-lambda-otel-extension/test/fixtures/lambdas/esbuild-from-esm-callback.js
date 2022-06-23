const __defProp = Object.defineProperty;
const __getOwnPropDesc = Object.getOwnPropertyDescriptor;
const __getOwnPropNames = Object.getOwnPropertyNames;
const __hasOwnProp = Object.prototype.hasOwnProperty;
const __export = (target, all) => {
  for (const name in all) {
    __defProp(target, name, { get: all[name], enumerable: true });
  }
};
const __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (const key of __getOwnPropNames(from)) {
      if (!__hasOwnProp.call(to, key) && key !== except) {
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
      }
    }
  }
  return to;
};
const __toCommonJS = (mod) => __copyProps(__defProp({}, '__esModule', { value: true }), mod);

// index.js
const test_serverless_exports = {};
__export(test_serverless_exports, { handler: () => handler });
module.exports = __toCommonJS(test_serverless_exports);
var handler = (event, context, callback) => {
  callback(null, { statusCode: 200, body: JSON.stringify({ result: 'ok', filename: __filename }) });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = { handler });
