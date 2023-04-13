// eslint-disable-next-line import/no-unresolved
import sdk from '@serverless/aws-lambda-sdk';

let counter = 0;

// eslint-disable-next-line import/prefer-default-export
export const handler = async () => {
  const invocationId = ++counter;
  if (!sdk) throw new Error('SDK not exported');

  sdk._createTraceSpan('user.span').close();

  sdk.captureError(new Error('Captured error'), {
    tags: { 'user.tag': 'example', 'invocationid': invocationId },
  });

  console.error('My error:', new Error('Consoled error'));

  sdk.captureWarning('Captured warning', {
    tags: { 'user.tag': 'example', 'invocationid': invocationId },
  });

  sdk.setTag('user.tag', `example:${invocationId}`);

  console.warn('Consoled warning', 12, true);

  sdk._createTraceSpan('custom.not.closed');

  return {
    name: sdk.name,
    version: sdk.version,
    rootSpanName: sdk.traceSpans.root.name,
  };
};
