// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import Hackerlog from './hackerlog';
import Logger from './logger';
import Options from './options';

var logger: Logger;
var options: Options;

// this method is called when your extension is activated. activation is
// controlled by the activation events defined in package.json
export function activate(ctx: vscode.ExtensionContext) {
  options = new Options();
  logger = new Logger('info');

  let hackerlog = new Hackerlog({
    vscode,
    logger: new Logger('info'),
    options: new Options(),
  });

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.editorKey', function(args) {
      hackerlog.promptForApiKey();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.proxy', function(args) {
      hackerlog.promptForProxy();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.debug', function(args) {
      hackerlog.promptForDebug();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.statusBarIcon', function(args) {
      hackerlog.promptStatusBarIcon();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hackerlog.dashboard', function(args) {
      hackerlog.openDashboardWebsite();
    }),
  );

  // dispose Hackerlog instance when this extension is deactivated
  ctx.subscriptions.push(hackerlog);

  options.getSetting('settings', 'debug', function(error, debug) {
    if (debug && debug.trim() === 'true') logger.setLevel('debug');
    hackerlog.initialize();
  });
}
