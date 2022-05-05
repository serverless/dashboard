'use strict';

module.exports = function eventType(event) {
  const type = 'aws.cloudwatch.event';
  return event.source && event.detail ? type : false;
};
