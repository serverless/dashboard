module.exports = function eventType(event) {
  const type = 'aws.ses';
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;
  // test is for firstEvent.EventVersion === '1.0'
  return eventSource === 'aws:ses' ? type : false;
};
