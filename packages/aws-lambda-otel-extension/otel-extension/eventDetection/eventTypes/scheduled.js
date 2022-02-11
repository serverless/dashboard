module.exports = function eventType(event) {
  const type = 'aws.scheduled';
  return event.source === 'aws.events' ? type : false;
};
