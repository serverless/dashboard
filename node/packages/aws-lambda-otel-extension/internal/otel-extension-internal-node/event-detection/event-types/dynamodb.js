'use strict';

module.exports = function eventType(event) {
  const type = 'aws.dynamodb';
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;

  return eventSource === 'aws:dynamodb' ? type : false;
};
