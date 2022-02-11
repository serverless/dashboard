module.exports = function eventType(event) {
  const type = 'aws.sns';
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { EventSource } = firstEvent;
  // test is for firstEvent.EventVersion === '1.0'
  return EventSource === 'aws:sns' ? type : false;
};
