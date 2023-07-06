'use strict';

module.exports = (events) =>
  events.map(({ eventName: name, tags }) => ({
    name,
    type: (() => {
      switch (name) {
        case 'telemetry.error.generated.v1':
          switch (tags.error.type) {
            case 1:
              return 'ERROR_TYPE_UNCAUGHT';
            case 2:
              return 'ERROR_TYPE_CAUGHT_USER';
            case 3:
              return 'ERROR_TYPE_CAUGHT_SDK_USER';
            case 4:
              return 'ERROR_TYPE_CAUGHT_SDK_INTERNAL';
            default:
              throw new Error(`Unexpected error type: ${tags.error.type}`);
          }
        case 'telemetry.warning.generated.v1':
          switch (tags.warning.type) {
            case 1:
              return 'WARNING_TYPE_USER';
            case 2:
              return 'WARNING_TYPE_SDK_USER';
            case 3:
              return 'WARNING_TYPE_SDK_INTERNAL';
            default:
              throw new Error(`Unexpected warning type: ${tags.warning.type}`);
          }
        case 'telemetry.notice.generated.v1':
          switch (tags.notice.type) {
            case 1:
              return 'NOTICE_TYPE_SDK_INTERNAL';
            default:
              throw new Error(`Unexpected notice type: ${tags.notice.type}`);
          }
        default:
          throw new Error(`Unexpected event name: ${name}`);
      }
    })(),
  }));
