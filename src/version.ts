import * as child_process from 'child_process';

export default (coreLocation: string, callback: (string) => void): void => {
  child_process.execFile(coreLocation, ['-v'], (error, stdout, stderr) => {
    if (error !== null) {
      if (stderr && stderr.toString() !== '') {
        this.logger.error(stderr.toString());
      }
      if (stdout && stdout.toString() !== '') {
        this.logger.error(stdout.toString());
      }
      this.logger.error(error.toString());
    } else {
      callback(stdout);
    }
  });
};
