import sdk from '@serverless/sdk';

let counter = 0;

// eslint-disable-next-line import/prefer-default-export
export const handler = async (event) => {
  const invocationId = ++counter;
  if (!sdk) throw new Error('SDK not exported');
  if (!event.isTriggeredByUnitTest) {
    // eslint-disable-next-line import/no-unresolved
    const sdkMirror = require('@serverless/aws-lambda-sdk');
    if (sdk !== sdkMirror) throw new Error('SDK exports mismatch');
  }

  sdk.createTraceSpan('user.span').close();

  sdk.captureError(new Error('Captured error'), {
    tags: { 'user.tag': 'example', 'invocationid': invocationId },
  });

  console.error('My error: ', new Error('Consoled error'));

  sdk.captureWarning('Captured warning', {
    tags: { 'user.tag': 'example', 'invocationid': invocationId },
  });

  console.warn('Consoled warning', 12, true);
  return {
    name: sdk.name,
    version: sdk.version,
    rootSpanName: sdk.traceSpans.root.name,
  };
};
