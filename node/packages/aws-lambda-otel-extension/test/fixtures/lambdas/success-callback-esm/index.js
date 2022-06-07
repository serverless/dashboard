// eslint-disable-next-line import/prefer-default-export
export const handler = (event, context, callback) => {
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({ result: 'ok', filename: 'esm-callback-success' }),
  });
};
