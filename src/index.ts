// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import Hackerlog from './hackerlog';
import Logger, { Levels } from './logger';
import Options, { Settings } from './options';

let logger: Logger;
let options: Options;

// this method is called when your extension is activated. activation is
// controlled by the activation events defined in package.json
export function activate(ctx: vscode.ExtensionContext) {
  logger = new Logger(Levels.info, vscode);
  options = new Options(logger);

  const hackerlog = new Hackerlog({
    vscode,
    logger,
    options,
  });

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.editorKey', () => {
      hackerlog.promptForEditorToken();
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.proxy', () => {
      hackerlog.promptForProxy();
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.debug', () => {
      hackerlog.promptForDebug();
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.statusBarIcon', () => {
      hackerlog.promptStatusBarIcon();
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.dashboard', () => {
      hackerlog.openDashboardWebsite();
    })
  );

  // dispose Hackerlog instance when this extension is deactivated
  ctx.subscriptions.push(hackerlog);

  options.getSetting(Settings.Debug, debug => {
    if (debug || process.env.IS_DEBUG === 'true') {
      logger.setLevel(Levels.debug);
    }
    hackerlog.initialize();
  });
}
