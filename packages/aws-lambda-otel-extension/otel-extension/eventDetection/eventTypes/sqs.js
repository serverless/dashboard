module.exports = function eventType(event) {
  const type = 'aws.sqs';
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;
  return eventSource === 'aws:sqs' ? type : false;
};
