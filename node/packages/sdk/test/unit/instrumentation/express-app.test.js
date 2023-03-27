'use strict';

const express = require('express');

const requireUncached = require('ncjsm/require-uncached');

describe('instrumentation/expres-app.js', () => {
  let instrumentExpressApp;
  before(() => {
    requireUncached(() => {
      instrumentExpressApp = require('../../../instrumentation/express-app');
    });
  });
  after(() => {
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });

  it('should instrument express app', () => {
    const app = express();
    // Sanity check
    instrumentExpressApp.install(app)();
  });
});
