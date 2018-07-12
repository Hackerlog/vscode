import { get } from 'lodash';
import * as Raven from 'raven';

export enum Levels {
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
}

export default class Logger {
  private level: Levels;
  private levelAmount = {
    [Levels.debug]: 0,
    [Levels.info]: 1,
    [Levels.warn]: 2,
    [Levels.error]: 4,
  };
  private isDebugging = process.env.IS_DEBUG === 'true';

  constructor(level: Levels, vscode) {
    this.setLevel(level);
    this.initSentry(vscode);
  }

  private initSentry(vscode): void {
    if (!this.isDebugging) {
      Raven.config(
        'https://0f033463374047f3ba843c0a8d84ee68:72e61a3d48a949b093dd4574bb6ca79b@sentry.io/1239966',
        {
          release: this.getVersion(vscode),
          tags: {
            os: process.platform,
            arch: process.arch,
          },
        }
      ).install();
    }
  }

  private getVersion(vscode): string {
    const packageJson = vscode.extensions.getExtension('hackerlog.hackerlog').packageJSON;
    return get(packageJson, 'version');
  }

  private sendToSentry(msg: string): void {
    if (!this.isDebugging) {
      Raven.captureMessage(msg);
    }
  }

  public setLevel(level: Levels): void {
    this.level = level;
  }

  public log(level: string, msg: string): void {
    if (this.levelAmount[level] >= this.levelAmount[this.level]) {
      msg = '[Hackerlog] [' + level.toUpperCase() + '] ' + msg;
      if (level === Levels.debug) {
        console.log(msg);
      }
      if (level === Levels.info) {
        console.info(msg);
      }
      if (level === Levels.warn) {
        console.warn(msg);
      }
      if (level === Levels.error) {
        console.error(msg);
      }
    }
  }

  public debug(msg: string): void {
    this.log(Levels.debug, msg);
  }

  public info(msg: string): void {
    this.log(Levels.info, msg);
  }

  public warn(msg: string): void {
    this.sendToSentry(msg);
    this.log(Levels.warn, msg);
  }

  public error(msg: string, err: Error | null = null): void {
    this.log(Levels.error, msg);
    this.sendToSentry(msg);
    if (err && !this.isDebugging) {
      Raven.captureException(err);
    }
  }
}
