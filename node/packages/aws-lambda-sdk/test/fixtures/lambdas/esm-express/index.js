import serverless from 'serverless-http';
import express from 'express';

const app = express();
app.use(express.json());

app.post('/test', (req, res) => {
  res.send('"ok"');
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

export const handler = serverless(app);
