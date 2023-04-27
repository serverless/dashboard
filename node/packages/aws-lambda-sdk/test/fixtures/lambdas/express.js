'use strict';

const serverless = require('serverless-http');
const express = require('express');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('"root"');
});

app.get('/foo', (req, res) => {
  res.send('"ok"');
});

app.post('/test', (req, res) => {
  res.send('"ok"');
});

const router = new express.Router();
router.post('/bar', (req, res) => {
  res.send('"ok"');
});

app.use('/nested', router);

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports.handler = serverless(app);
