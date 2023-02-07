import { STS } from '@aws-sdk/client-sts';

const sts = new STS();

export const handler = async () => {
  // STS (confirm on tracing of any AWS service)
  await sts.getCallerIdentity();

  return 'ok';
};
