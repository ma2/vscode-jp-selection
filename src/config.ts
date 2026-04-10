import * as vscode from 'vscode';

export interface JpSelectionConfig {
  additionalSeparators: Set<number>;
  doubleClickThresholdMs: number;
}

export function readConfig(): JpSelectionConfig {
  const cfg = vscode.workspace.getConfiguration('jpSelection');
  const raw: string = cfg.get<string>('additionalSeparators', '');
  const thresholdMs: number = cfg.get<number>('doubleClickThresholdMs', 400);

  const separators = new Set<number>();
  // for...of はコードポイント単位で反復するためサロゲートペアを正しく処理できる
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) separators.add(cp);
  }

  return { additionalSeparators: separators, doubleClickThresholdMs: thresholdMs };
}
