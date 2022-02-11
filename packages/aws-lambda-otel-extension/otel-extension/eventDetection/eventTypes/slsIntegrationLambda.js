module.exports = function eventType(event) {
  const type = 'aws.apigateway.http';

  const keys = ['body', 'method', 'principalId', 'stage'];

  const keysThatNeedValues = ['identity.userAgent', 'identity.sourceIp', 'identity.accountId'];
  if (typeof event === 'object') {
    const keysArePresent = keys.every((key) => key in event);
    const valuesArePresent =
      keysThatNeedValues
        .map(() => {
          return typeof event?.key !== 'undefined';
        })
        .filter(Boolean).length === keysThatNeedValues.length;
    return keysArePresent && valuesArePresent ? type : false;
  }
  return false;
};
