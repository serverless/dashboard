const fetch = require('node-fetch');

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime`;

async function getEventData() {
  const res = await fetch(`${baseUrl}/invocation/next`, {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    console.error('next failed', await res.text());
    return null;
  }

  const body = await res.json();
  return {
    body,
    requestId: res.headers.get('Lambda-Runtime-Aws-Request-Id'),
  };
}

async function getResponse(requestId) {
  const res = await fetch(`${baseUrl}/invocation/${requestId}/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: 'Success',
  });

  if (!res.ok) {
    console.error('next failed', await res.text());
    return null;
  }

  return res.text();
}

module.exports = {
  getEventData,
  getResponse,
};
