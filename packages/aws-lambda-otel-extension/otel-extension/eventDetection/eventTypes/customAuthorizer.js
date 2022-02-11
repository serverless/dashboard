module.exports = function eventType(event) {
  const type = 'aws.apigateway.authorizer';
  if (typeof event === 'object') {
    const hasMethodArn = event.methodArn;
    const hasType = ['TOKEN', 'REQUEST'].includes(event.type);
    return hasMethodArn && hasType ? type : false;
  }
  return false;
};
