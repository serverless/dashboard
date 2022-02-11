'use strict';

module.exports = function eventType(event) {
  const type = 'aws.cloudwatch.log';
  return event.awslogs && event.awslogs.data ? type : false;
};
