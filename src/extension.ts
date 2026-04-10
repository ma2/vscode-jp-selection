import * as vscode from 'vscode';
import { SelectionHandler } from './selectionHandler';
import { readConfig } from './config';

export function activate(context: vscode.ExtensionContext): void {
  let config = readConfig();
  const handler = new SelectionHandler(config);

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(
      (event) => handler.handleSelectionChange(event),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('jpSelection')) {
        config = readConfig();
        handler.updateConfig(config);
      }
    }),
  );
}

export function deactivate(): void {
  // Subscriptions are automatically disposed via context.subscriptions
}
