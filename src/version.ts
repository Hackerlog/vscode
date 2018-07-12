import * as child_process from 'child_process';
import Logger from './logger';

export default (
  coreLocation: string,
  logger: Logger,
  callback: (version: string) => void
): void => {
  child_process.execFile(coreLocation, ['-v'], (error, stdout, stderr) => {
    if (error !== null) {
      if (stderr && stderr.toString() !== '') {
        logger.warn(stderr.toString());
      }
      if (stdout && stdout.toString() !== '') {
        logger.warn(stdout.toString());
      }
      logger.warn(error.toString());
      callback('');
    } else {
      callback(stdout.toString().trim());
    }
  });
};
