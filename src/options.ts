import * as fs from 'fs';
import { readJson } from 'fs-extra';
import { noop, get, assign } from 'lodash';
import * as path from 'path';

import Dependencies from './dependencies';
import Logger from './logger';

export enum Settings {
  StatusBarIcon = 'statusBarIcon',
  EditorKey = 'editorKey',
  Proxy = 'proxy',
  Debug = 'debug',
}

interface ISettings {
  [Settings.StatusBarIcon]: string | undefined;
  [Settings.EditorKey]: string | undefined;
  [Settings.Proxy]: string | undefined;
  [Settings.Debug]: boolean | undefined;
}

export default class Options {
  private configFile = path.join(this.getHome(), '.hackerlog.config.json');
  private logFile = path.join(this.getHome(), '.hackerlog.log');
  private settings: ISettings | null = null;
  private logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
  }

  public async getSetting(key: Settings, callback: (string?, any?) => void = noop): Promise<void> {
    const content = await readJson(this.getConfigFile());
    callback(get(content, key));
  }

  // TODO: Update this with the fs-extra method
  public setSetting(key: Settings, val: string, callback: (Error) => void = noop): void {
    const content = assign({}, this.settings, { [key]: val });

    fs.writeFile(this.getConfigFile(), JSON.stringify(content, null, 4), function(err) {
      if (err) {
        callback(new Error('could not write to ' + this.getConfigFile()));
      } else {
        callback(null);
      }
    });
  }

  public getConfigFile(): string {
    return this.configFile;
  }

  public getLogFile(): string {
    return this.logFile;
  }

  public getUserHomeDir(): string {
    return process.env[Dependencies.isWindows() ? 'USERPROFILE' : 'HOME'] || '';
  }

  private getHome(): string {
    const home = process.env.HACKERLOG_HOME;
    if (home) {
      return home;
    } else {
      return this.getUserHomeDir();
    }
  }
}
