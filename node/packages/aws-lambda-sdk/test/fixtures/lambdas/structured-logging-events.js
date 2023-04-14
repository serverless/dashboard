'use strict';

const sdk = require('@serverless/sdk');
const { Logger: PowertoolsLogger } = require('@aws-lambda-powertools/logger');
const pino = require('pino');
const winston = require('winston');
const bunyan = require('bunyan');

module.exports.handler = async () => {
  if (!sdk) throw new Error('SDK not exported');

  const powertooolsLogger = new PowertoolsLogger({
    serviceName: 'test-app',
    persistentLogAttributes: { testtag: 'test tag' },
  });

  const pinoParent = pino();
  const pinoLogger = pinoParent.child({ testtag: 'test tag' });

  const winstonParent = winston.createLogger({
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
  });
  const winstonLogger = winstonParent.child({ testtag: 'test tag' });

  const bunyanParent = bunyan.createLogger({ name: 'bunyan-test' });
  const bunyanLogger = bunyanParent.child({ testtag: 'test tag' });

  const error = new Error('Test Error');

  error.name = 'PowertoolsError';
  powertooolsLogger.error('powertools error', error);
  error.name = 'PinoError';
  pinoLogger.error(error);
  error.name = 'WinstonError';
  winstonLogger.error('winston error', error);
  error.name = 'BunyanError';
  bunyanLogger.error(error, 'bunyan error');

  powertooolsLogger.warn('PowertoolsWarning');
  pinoLogger.warn('PinoWarning');
  winstonLogger.warn('WinstonWarning');
  bunyanLogger.warn('BunyanWarning');

  return 'ok';
};
