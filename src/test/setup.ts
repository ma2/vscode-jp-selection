// テスト実行時に本物の VSCode なしで動作させるための vscode モジュールモック。
// mocha の --require で他のファイルより先に読み込まれる必要がある。
const Module = require('module') as { _load: Function };
const originalLoad = Module._load;
Module._load = function (request: string, ...args: unknown[]) {
  if (request === 'vscode') {
    return {
      TextEditorSelectionChangeKind: { Mouse: 2 },
    };
  }
  return originalLoad.apply(this, [request, ...args]);
};
