'use strict';

const serverless = require('serverless-http');
const express = require('express');

const app = express();
app.use(express.json());

const router = new express.Router();
router.post('/bar', (req, res) => {
  res.send('"ok"');
});

app.use('/foo', router);

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports.handler = serverless(app);
