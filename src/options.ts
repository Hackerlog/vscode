import * as path from "path";
import * as fs from "fs";
import * as get from "lodash/get";
import * as noop from "lodash/noop";
import * as assign from "lodash/assign";

import Dependencies from "./dependencies";
import Logger from "./logger";

export enum Settings {
  StatusBarIcon = "statusBarIcon",
  EditorKey = "editorKey",
  Proxy = "proxy",
  Debug = "debug"
}

interface ISettings {
  [Settings.StatusBarIcon]: string | undefined;
  [Settings.EditorKey]: string | undefined;
  [Settings.Proxy]: string | undefined;
  [Settings.Debug]: boolean | undefined;
}

export default class Options {
  private configFile = path.join(this.getHome(), ".hackerlog.config.json");
  private logFile = path.join(this.getHome(), ".hackerlog.log");
  private settings: ISettings | null = null;
  private logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
    this.loadConfig();
  }

  private loadConfig(): void {
    fs.readFile(
      this.getConfigFile(),
      "utf-8",
      (err: NodeJS.ErrnoException, content: string) => {
        if (err) {
          this.logger.error("Could not load settings file", err);
        } else {
          this.settings = JSON.parse(content);
        }
      }
    );
  }

  private getHome(): string {
    let home = process.env.HACKERLOG_HOME;
    if (home) {
      return home;
    } else {
      return this.getUserHomeDir();
    }
  }

  public getSetting(
    key: Settings,
    callback: (string?, any?) => void = noop
  ): void {
    callback(get(this.settings, key));
  }

  public setSetting(
    key: Settings,
    val: string,
    callback: (Error) => void = noop
  ): void {
    const content = assign({}, this.settings, { [key]: val });
    fs.writeFile(
      this.getConfigFile(),
      JSON.stringify(content, null, 4),
      function(err) {
        if (err) {
          callback(new Error("could not write to " + this.getConfigFile()));
        } else {
          callback(null);
        }
      }
    );
  }

  public getConfigFile(): string {
    return this.configFile;
  }

  public getLogFile(): string {
    return this.logFile;
  }

  public getUserHomeDir(): string {
    return process.env[Dependencies.isWindows() ? "USERPROFILE" : "HOME"] || "";
  }
}
