import * as child_process from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import Dependencies from './dependencies';
import Logger, { Levels } from './logger';
import Options, { Settings } from './options';
import Pulse from './pulse';
import { apiBaseUrl } from './constants';

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
  private pulseEndpoint = `${apiBaseUrl}/units`;

  constructor({ vscodeInstance, logger, options }) {
    this.vscode = vscodeInstance;
    this.logger = logger;
    this.options = options;
    this.extension = this.vscode.extensions.getExtension('hackerlog.hackerlog').packageJSON;
    this.statusBar = this.vscode.StatusBarItem = this.vscode.window.createStatusBarItem(
      this.vscode.StatusBarAlignment.Left
    );
  }

  public async initialize(): Promise<void> {
    this.logger.debug('Initializing Hackerlog v' + this.extension.version);
    this.statusBar.text = '$(clock) Hackerlog Initializing...';
    this.statusBar.show();

    // 1. See if the Editor Key is available. If it is, proceed. If not, prompt for it.
    await this.checkEditorToken();

    this.dependencies = new Dependencies(this.options, this.logger);

    await this.dependencies.installOrUpdateCore(async () => {
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

    await this.setupEventListeners();
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
      this.vscode.window.showInputBox(promptOptions).then(async val => {
        if (this.validateKey(val) === null) {
          try {
            await this.options.setSetting(Settings.EditorKey, val);
          } catch (err) {
            this.logger.warn(err);
          }
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
      this.vscode.window.showInputBox(promptOptions).then(async val => {
        if (val || val === '') {
          try {
            await this.options.setSetting(Settings.Proxy, val);
          } catch (err) {
            this.logger.warn(err);
          }
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
      this.vscode.window.showQuickPick(items, promptOptions).then(async newVal => {
        if (newVal === null) {
          return;
        }
        try {
          await this.options.setSetting(Settings.Debug, newVal);
        } catch (err) {
          this.logger.warn(err);
        }
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
      this.vscode.window.showQuickPick(items, promptOptions).then(async newVal => {
        if (newVal === null) {
          return;
        }
        try {
          await this.options.setSetting(Settings.StatusBarIcon, newVal);
        } catch (err) {
          this.logger.warn(err);
        }
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

  private async checkEditorToken(): Promise<void> {
    await this.hasEditorToken(hasEditorToken => {
      this.logger.debug('Has editor token: ' + hasEditorToken);
      if (!hasEditorToken) {
        this.promptForEditorToken();
      }
    });
  }

  private async hasEditorToken(
    callback: (hasToken: boolean, editorToken: string) => void
  ): Promise<void> {
    try {
      await this.options.getSetting(Settings.EditorKey, editorKey => {
        callback(!!editorKey, editorKey);
      });
    } catch (err) {
      this.logger.error('Could not retrieve editor token from config: ', err);
    }
  }

  private async setupEventListeners(): Promise<void> {
    // subscribe to selection change and editor activation events
    const subscriptions: vscode.Disposable[] = [];
    this.vscode.window.onDidChangeTextEditorSelection(this.onChange, this, subscriptions);
    this.vscode.window.onDidChangeActiveTextEditor(this.onChange, this, subscriptions);
    this.vscode.workspace.onDidSaveTextDocument(this.onSave, this, subscriptions);

    // create a combined disposable from both event subscriptions
    this.disposable = this.vscode.Disposable.from(...subscriptions);

    this.logger.debug('Event listeners are setup.');
  }

  private async onChange(): Promise<void> {
    await this.onEvent(false);
  }

  private async onSave(): Promise<void> {
    await this.onEvent(true);
  }

  private async onEvent(isWrite: boolean): Promise<void> {
    const editor = this.vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      if (doc) {
        const file: string = doc.fileName;
        if (file) {
          const time: number = Date.now();
          if (isWrite || this.enoughTimePassed(time) || this.lastFile !== file) {
            this.logger.debug('Sending a pulse for: ' + file);
            await this.sendPulse(file, isWrite);
            this.lastFile = file;
            this.lastPulse = time;
          }
        }
      }
    }
  }

  private async sendPulse(file: string, isWrite): Promise<void> {
    this.logger.info(isWrite);
    await this.hasEditorToken((hasEditorToken, editorToken) => {
      if (hasEditorToken) {
        const coreIsInstalled = this.dependencies.isCoreInstalled();
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
                this.statusBar.tooltip = 'Hackerlog: Last heartbeat sent ' + this.formatDate(today);
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
                const errorMessage =
                  'Config Parsing Error (103); Check your ' +
                  this.options.getLogFile() +
                  ' file for more details.';
                this.statusBar.tooltip = 'Hackerlog: ' + errorMessage;
                this.logger.error(errorMessage);
              } else if (code === 104) {
                this.statusBar.text = '$(clock) Hackerlog Error';
                const errorMessage = 'Invalid API Key (104); Make sure your API Key is correct!';
                this.statusBar.tooltip = 'Hackerlog: ' + errorMessage;
                this.logger.error(errorMessage);
              } else {
                this.statusBar.text = '$(clock) Hackerlog Error';
                const errorMessage =
                  'Unknown Error (' +
                  code +
                  '); Check your ' +
                  this.options.getLogFile() +
                  ' file for more details.';
                this.statusBar.tooltip = 'Hackerlog: ' + errorMessage;
                this.logger.error(errorMessage);
              }
            });
          });
        } else {
          this.logger.info('Core is not installed but a pulse was attempted.');
        }
      } else {
        this.promptForEditorToken();
      }
    });
  }

  private formatDate(date: Date): string {
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
}
