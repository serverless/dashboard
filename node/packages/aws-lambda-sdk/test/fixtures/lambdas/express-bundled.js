'use strict';

// eslint-disable-next-line import/no-unresolved
const serverlessSdk = require('@serverless/aws-lambda-sdk');
const serverless = require('serverless-http');
const express = require('express');

const app = express();
serverlessSdk.instrumentation.expressApp.install(app);
app.use(express.json());

app.post('/test', (req, res) => {
  res.send('"ok"');
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports.handler = serverless(app);
