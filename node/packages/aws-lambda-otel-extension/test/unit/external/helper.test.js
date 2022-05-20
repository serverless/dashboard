'use strict';

const { expect } = require('chai');
const { stripResponseBlobData } = require('../../../external/otel-extension-external/helper');

describe('external helper', () => {
  describe('stripResponseBlobData', () => {
    it('should redact entire body if it is not json', () => {
      const data = {
        responseData: 'This is just a standard text string',
      };
      const out = stripResponseBlobData(data);

      expect('isBodyExcluded' in out).to.equal(false);
      expect('responseData' in out).to.equal(false);
    });

    it('should redact body from http response if it is not json', () => {
      const data = {
        responseData: {
          headers: {
            'Content-Type': 'text/html',
          },
          body: 'Some random string...',
        },
      };
      const out = stripResponseBlobData(data);

      expect(out.isBodyExcluded).to.equal(true);
      expect(out.responseData).to.deep.equal(
        JSON.stringify({
          headers: data.responseData.headers,
        })
      );
    });

    it('should keep body from http response if it is json', () => {
      const data = {
        responseData: {
          headers: {
            'Content-Type': 'text/html',
          },
          body: JSON.stringify({ message: 'I am json' }),
        },
      };
      const out = stripResponseBlobData(data);

      expect('isBodyExcluded' in out).to.equal(false);
      expect(out.responseData).to.deep.equal(data.responseData);
    });

    it('should keep body if it is json and not an http response', () => {
      const data = {
        responseData: {
          message: 'hello there',
        },
      };
      const out = stripResponseBlobData(data);

      expect('isBodyExcluded' in out).to.equal(false);
      expect(out.responseData).to.deep.equal(data.responseData);
    });
  });
});
