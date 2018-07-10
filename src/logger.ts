import * as Raven from "raven";
import * as get from "lodash/get";

export enum Levels {
  debug = "debug",
  info = "info",
  warn = "warn",
  error = "error"
}

export default class Logger {
  private level: Levels;
  private levelAmount = {
    [Levels.debug]: 0,
    [Levels.info]: 1,
    [Levels.warn]: 2,
    [Levels.error]: 4
  };

  constructor(level: Levels, vscode) {
    this.setLevel(level);
    Raven.config(
      "https://0f033463374047f3ba843c0a8d84ee68:72e61a3d48a949b093dd4574bb6ca79b@sentry.io/1239966",
      {
        release: this.getVersion(vscode),
        tags: {
          os: process.platform,
          arch: process.arch
        }
      }
    ).install();
  }

  private getVersion(vscode): string {
    const packageJson = vscode.extensions.getExtension("hackerlog.hackerlog")
      .packageJSON;
    return get(packageJson, "version");
  }

  public setLevel(level: Levels): void {
    this.level = level;
  }

  public log(level: string, msg: string): void {
    if (this.levelAmount[level] >= this.levelAmount[this.level]) {
      msg = "[Hackerlog] [" + level.toUpperCase() + "] " + msg;
      if (level === Levels.debug) {
        console.log(msg);
      }
      if (level === Levels.info) {
        console.info(msg);
      }
      if (level === Levels.warn) {
        Raven.captureMessage(msg);
        console.warn(msg);
      }
      if (level === Levels.error) {
        Raven.captureMessage(msg);
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
    this.log(Levels.warn, msg);
  }

  public error(msg: string, err: Error | null = null): void {
    this.log(Levels.error, msg);
    if (err) {
      Raven.captureException(err);
    }
  }
}
