import { readJson, outputJson, ensureFileSync } from 'fs-extra';
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
  private configFile = path.join(this.getHome(), '.hackerlog.conf');
  private logFile = path.join(this.getHome(), '.hackerlog.log');
  private settings: ISettings | null = null;
  private logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
    ensureFileSync(this.getConfigFile());
  }

  public async getSetting(key: Settings, callback: (val?: string) => void = noop): Promise<void> {
    try {
      const content = await readJson(this.getConfigFile(), { throws: false });
      callback(get(content, key));
    } catch (err) {
      this.logger.warn('Could not get settings: ' + err);
    }
  }

  public async setSetting(
    key: Settings,
    val: string,
    callback: (Error) => void = noop
  ): Promise<void> {
    try {
      const content = assign({}, this.settings, { [key]: val });
      await outputJson(this.getConfigFile(), content);
      callback(null);
    } catch (err) {
      callback(new Error('could not write to ' + this.getConfigFile()));
      this.logger.error('Could not write settings file: ', err);
    }
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
