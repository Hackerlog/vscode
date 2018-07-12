import * as child_process from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import Dependencies from './dependencies';
import Logger, { Levels } from './logger';
import Options, { Settings } from './options';
import Pulse from './pulse';

export default class Hackerlog {
  private vscode;
  private logger: Logger;
  private extension;
  private statusBar;
  private disposable: vscode.Disposable;
  private lastFile: string;
  private lastPulse: number = 0;
  private dependencies: Dependencies;
  private options: Options;
  private pulseEndpoint = 'http://localhost:8000/v1/units';

  constructor({ vscode, logger, options }) {
    this.vscode = vscode;
    this.logger = logger;
    this.options = options;
    this.extension = vscode.extensions.getExtension('hackerlog.hackerlog').packageJSON;
    this.statusBar = vscode.StatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
  }

  public initialize(): void {
    this.logger.debug('Initializing Hackerlog v' + this.extension.version);
    this.statusBar.text = '$(clock) Hackerlog Initializing...';
    this.statusBar.show();

    this.checkApiKey();

    this.dependencies = new Dependencies(this.options, this.logger);
    this.dependencies.checkAndInstall(async () => {
      this.statusBar.text = '$(clock)';
      this.statusBar.tooltip = 'Hackerlog: Initialized';
      await this.options.getSetting(Settings.StatusBarIcon, val => {
        if (val && val.trim() === 'false') {
          this.statusBar.hide();
        } else {
          this.statusBar.show();
        }
      });
    });

    this.setupEventListeners();
  }

  public async promptForEditorToken(): Promise<void> {
    await this.options.getSetting(Settings.EditorKey, defaultVal => {
      if (this.validateKey(defaultVal) !== null) {
        defaultVal = '';
      }
      const promptOptions = {
        prompt: 'Hackerlog Editor Key',
        placeHolder: 'Enter your editor key from hackerlog.io/me',
        value: defaultVal,
        ignoreFocusOut: true,
        validateInput: this.validateKey.bind(this),
      };
      this.vscode.window.showInputBox(promptOptions).then(val => {
        if (this.validateKey(val) === null) {
          this.options.setSetting(Settings.EditorKey, val);
        }
      });
    });
  }

  public async promptForProxy(): Promise<void> {
    await this.options.getSetting(Settings.Proxy, defaultVal => {
      if (!defaultVal) {
        defaultVal = '';
      }
      const promptOptions = {
        prompt: 'Hackerlog Proxy',
        placeHolder: 'Proxy format is https://user:pass@host:port',
        value: defaultVal,
        ignoreFocusOut: true,
        validateInput: this.validateProxy.bind(this),
      };
      this.vscode.window.showInputBox(promptOptions).then(val => {
        if (val || val === '') {
          this.options.setSetting(Settings.Proxy, val);
        }
      });
    });
  }

  public promptForDebug(): void {
    this.options.getSetting(Settings.Debug, defaultVal => {
      if (!defaultVal || defaultVal.trim() !== 'true') {
        defaultVal = 'false';
      }
      const items: string[] = ['true', 'false'];
      const promptOptions = {
        placeHolder: 'true or false (Currently ' + defaultVal + ')',
        value: defaultVal,
        ignoreFocusOut: true,
      };
      this.vscode.window.showQuickPick(items, promptOptions).then(newVal => {
        if (newVal === null) {
          return;
        }
        this.options.setSetting(Settings.Debug, newVal);
        if (newVal === 'true') {
          this.logger.setLevel(Levels.debug);
          this.logger.debug('Debug enabled');
        } else {
          this.logger.setLevel(Levels.info);
        }
      });
    });
  }

  public promptStatusBarIcon(): void {
    this.options.getSetting(Settings.StatusBarIcon, defaultVal => {
      if (!defaultVal || defaultVal.trim() !== 'false') {
        defaultVal = 'true';
      }
      const items: string[] = ['true', 'false'];
      const promptOptions = {
        placeHolder: 'true or false (Currently ' + defaultVal + ')',
        value: defaultVal,
        ignoreFocusOut: true,
      };
      this.vscode.window.showQuickPick(items, promptOptions).then(newVal => {
        if (newVal === null) {
          return;
        }
        this.options.setSetting(Settings.StatusBarIcon, newVal);
        if (newVal === 'true') {
          this.statusBar.show();
          this.logger.debug('Status bar icon enabled');
        } else {
          this.statusBar.hide();
          this.logger.debug('Status bar icon disabled');
        }
      });
    });
  }

  public openDashboardWebsite(): void {
    let open = 'xdg-open';
    const args = ['https://hackerlog.io/me'];
    if (Dependencies.isWindows()) {
      open = 'cmd';
      args.unshift('/c', 'start', '""');
    } else if (os.type() === 'Darwin') {
      open = 'open';
    }
    child_process.execFile(open, args, (error, stdout, stderr) => {
      if (error !== null) {
        if (stderr && stderr.toString() !== '') {
          this.logger.error(stderr.toString());
        }
        if (stdout && stdout.toString() !== '') {
          this.logger.error(stdout.toString());
        }
        this.logger.error(error.toString());
      }
    });
  }

  public dispose() {
    this.statusBar.dispose();
    this.disposable.dispose();
  }

  private validateKey(key: string): string {
    const err = 'Invalid editor key... check https://hackerlog.io/me for your key.';
    if (!key) {
      return err;
    }
    const re = new RegExp('^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$', 'i');
    if (!re.test(key)) {
      return err;
    }
    return null;
  }

  private validateProxy(proxy: string): string {
    const err =
      'Invalid proxy. Valid formats are https://user:pass@host:port or socks5://user:pass@host:port or domain\\user:pass.';
    if (!proxy) {
      return err;
    }
    let re = new RegExp('^((https?|socks5)://)?([^:@]+(:([^:@])+)?@)?[\\w\\.-]+(:\\d+)?$', 'i');
    if (proxy.indexOf('\\') > -1) {
      re = new RegExp('^.*\\\\.+$', 'i');
    }
    if (!re.test(proxy)) {
      return err;
    }
    return null;
  }

  private checkApiKey(): void {
    this.hasEditorToken(hasApiKey => {
      if (!hasApiKey) {
        this.promptForEditorToken();
      }
    });
  }

  private hasEditorToken(callback: (boolean, string) => void): void {
    this.options.getSetting(Settings.EditorKey, editorKey => {
      callback(editorKey !== null, editorKey);
    });
  }

  private setupEventListeners(): void {
    // subscribe to selection change and editor activation events
    const subscriptions: vscode.Disposable[] = [];
    this.vscode.window.onDidChangeTextEditorSelection(this.onChange, this, subscriptions);
    this.vscode.window.onDidChangeActiveTextEditor(this.onChange, this, subscriptions);
    this.vscode.workspace.onDidSaveTextDocument(this.onSave, this, subscriptions);

    // create a combined disposable from both event subscriptions
    this.disposable = this.vscode.Disposable.from(...subscriptions);
  }

  private onChange(): void {
    this.onEvent(false);
  }

  private onSave(): void {
    this.onEvent(true);
  }

  private onEvent(isWrite: boolean): void {
    const editor = this.vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      if (doc) {
        const file: string = doc.fileName;
        if (file) {
          const time: number = Date.now();
          if (isWrite || this.enoughTimePassed(time) || this.lastFile !== file) {
            this.sendPulse(file, isWrite);
            this.lastFile = file;
            this.lastPulse = time;
          }
        }
      }
    }
  }

  private sendPulse(file: string, isWrite): void {
    this.logger.info(isWrite);
    this.hasEditorToken((hasEditorToken, editorToken) => {
      if (hasEditorToken) {
        this.dependencies.checkAndCreateHomeDir(coreIsInstalled => {
          if (coreIsInstalled) {
            const coreLocation = this.dependencies.getCoreLocation();
            const splitFile = file.split(path.sep);
            const fileName = splitFile[splitFile.length - 1];

            const flags = {
              apiUrl: this.pulseEndpoint,
              editorToken,
              editorType: 'vscode',
              fileName,
              projectName: this.getProjectName(file),
              startedAt: new Date(this.lastPulse).toISOString(),
              stoppedAt: new Date().toISOString(),
            };

            const pulse = new Pulse({
              flags,
              coreLocation,
              logger: this.logger,
            });

            pulse.run(process => {
              process.on('close', (code, _) => {
                if (code === 0) {
                  this.statusBar.text = '$(clock)';
                  const today = new Date();
                  this.statusBar.tooltip =
                    'Hackerlog: Last heartbeat sent ' + this.formatDate(today);
                } else if (code === 102) {
                  this.statusBar.text = '$(clock)';
                  this.statusBar.tooltip =
                    'Hackerlog: Working offline... coding activity will sync next time we are online.';
                  this.logger.warn(
                    'API Error (102); Check your ' +
                      this.options.getLogFile() +
                      ' file for more details.'
                  );
                } else if (code === 103) {
                  this.statusBar.text = '$(clock) Hackerlog Error';
                  const error_msg =
                    'Config Parsing Error (103); Check your ' +
                    this.options.getLogFile() +
                    ' file for more details.';
                  this.statusBar.tooltip = 'Hackerlog: ' + error_msg;
                  this.logger.error(error_msg);
                } else if (code === 104) {
                  this.statusBar.text = '$(clock) Hackerlog Error';
                  const error_msg = 'Invalid API Key (104); Make sure your API Key is correct!';
                  this.statusBar.tooltip = 'Hackerlog: ' + error_msg;
                  this.logger.error(error_msg);
                } else {
                  this.statusBar.text = '$(clock) Hackerlog Error';
                  const error_msg =
                    'Unknown Error (' +
                    code +
                    '); Check your ' +
                    this.options.getLogFile() +
                    ' file for more details.';
                  this.statusBar.tooltip = 'Hackerlog: ' + error_msg;
                  this.logger.error(error_msg);
                }
              });
            });
          }
        });
      } else {
        this.promptForEditorToken();
      }
    });
  }

  private formatDate(date: Date): String {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    let ampm = 'AM';
    let hour = date.getHours();
    if (hour > 11) {
      ampm = 'PM';
      hour = hour - 12;
    }
    if (hour === 0) {
      hour = 12;
    }
    const minute = date.getMinutes();
    return (
      months[date.getMonth()] +
      ' ' +
      date.getDate() +
      ', ' +
      date.getFullYear() +
      ' ' +
      hour +
      ':' +
      (minute < 10 ? '0' + minute : minute) +
      ' ' +
      ampm
    );
  }

  private enoughTimePassed(time: number): boolean {
    return this.lastPulse + 120000 < time;
  }

  private getProjectName(file: string): string {
    const uri = this.vscode.Uri.file(file);
    const workspaceFolder = this.vscode.workspace.getWorkspaceFolder(uri);
    const defaultName = 'unknown-project';
    if (this.vscode.workspace && workspaceFolder) {
      try {
        if (!workspaceFolder.name) {
          return defaultName;
        }
        return workspaceFolder.name;
      } catch (e) {
        return defaultName;
      }
    }
    return defaultName;
  }

  // TODO: Maybe use this?
  private obfuscateKey(key: string): string {
    let newKey = '';
    if (key) {
      newKey = key;
      if (key.length > 4) {
        newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
      }
    }
    return newKey;
  }
}
