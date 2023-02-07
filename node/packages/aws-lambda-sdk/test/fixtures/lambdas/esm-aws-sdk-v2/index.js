import AWS from 'aws-sdk';

const sts = new AWS.STS();

export const handler = async () => {
  // STS (confirm on tracing of any AWS service)
  await sts.getCallerIdentity().promise();

  return 'ok';
};
