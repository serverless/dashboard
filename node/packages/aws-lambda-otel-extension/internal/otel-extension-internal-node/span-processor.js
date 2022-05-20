'use strict';

const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const clone = require('lodash.clone');

class SlsSpanProcessor extends SimpleSpanProcessor {
  constructor(...args) {
    super(...args);
    this.incompleteSpans = {};
  }

  onStart(span) {
    this.incompleteSpans[span.name] = span;
  }

  onEnd(span) {
    delete this.incompleteSpans[span.name];
    super.onEnd(span);
  }

  finishAllSpans() {
    Object.keys(this.incompleteSpans).forEach((id) => {
      const span = clone(this.incompleteSpans[id]);
      span.end();
      this.onEnd(span);
    });
  }
}

module.exports = SlsSpanProcessor;
