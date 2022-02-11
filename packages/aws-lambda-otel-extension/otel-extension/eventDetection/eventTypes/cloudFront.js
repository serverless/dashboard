'use strict';

module.exports = function eventType(event) {
  const type = 'aws.cloudfront';
  const { Records = [] } = event;
  return Records[0] && Records[0].cf ? type : false;
};
