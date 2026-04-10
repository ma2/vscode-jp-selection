# jp-selection 仕様書

VSCode 拡張機能。日本語テキストのダブルクリック選択を文字種ごとに制御する。

## 動作概要

### 日本語文字をダブルクリック

クリックした文字の種類に応じて、同種の文字の連続を選択する。

| クリックした文字 | 選択範囲 |
|---|---|
| 漢字 | 連続する漢字のみ |
| ひらがな | 連続するひらがな（長音符「ー」を含む） |
| カタカナ | 連続するカタカナ（長音符「ー」を含む） |

長音符「ー」（U+30FC）はひらがな・カタカナどちらにも属する文字として扱う。

**例:**

```
テキスト: 日本語のテスト
          ^^^^           → 「日本語」（漢字の連続）
               ^^^^^     → 「テスト」（カタカナの連続）
```

```
テキスト: ひらがなとカタカナ
          ^^^^^^           → 「ひらがな」（ひらがなの連続）
                 ^^^^      → 「カタカナ」（カタカナの連続）
```

### 非日本語文字（ASCII英数字など）をダブルクリック

VSCode のデフォルト選択動作に従い、さらに以下を区切り文字として選択範囲をトリムする。

- 日本語文字（漢字・ひらがな・カタカナ）
- CJK句読点・括弧類（U+3000–U+303F, U+FF00–U+FFEF）
- `jpSelection.additionalSeparators` に指定した文字

---

## 区切り文字

以下のいずれかに該当する文字で選択が止まる。

| 種別 | Unicode 範囲 / 内容 |
|---|---|
| ASCII 全般 | U+0000–U+007F |
| 全角スペース | U+3000 |
| CJK 句読点・括弧 | U+3001–U+303F |
| 全角英数・半角カナ | U+FF00–U+FFEF |
| 追加区切り文字 | 設定 `jpSelection.additionalSeparators` で指定した文字 |

---

## 設定

| 設定キー | 型 | デフォルト | スコープ | 説明 |
|---|---|---|---|---|
| `jpSelection.additionalSeparators` | string | `""` | リソース | 追加の区切り文字。例: `「_#@」` |
| `jpSelection.doubleClickThresholdMs` | number | `400` | ウィンドウ | ダブルクリック判定の時間閾値（ms）。範囲: 100–2000 |

---

## 対応 Unicode 範囲

| 文字種 | 範囲 |
|---|---|
| CJK統合漢字 | U+4E00–U+9FFF |
| CJK拡張A | U+3400–U+4DBF |
| CJK互換漢字 | U+F900–U+FAFF |
| ひらがな | U+3041–U+3096 |
| カタカナ | U+30A1–U+30FA, U+30FC–U+30FE |

---

## 既知の制限

- **ちらつき:** ダブルクリック時、VSCode がデフォルト選択を一瞬描画した後に拡張機能が選択を上書きするため、わずかなちらつきが発生する。VSCode の拡張機能 API ではこれを抑制できない。
- **ドラッグ選択:** 日本語文字上でダブルクリックしてそのままドラッグした場合、VSCode が日本語テキスト全体を1単語として扱うため、文字種ごとの境界でのドラッグ選択拡張はサポートしない。

---

## ビルドとインストール

### コンパイル

```bash
npm run compile
```

`src/` 以下の TypeScript を `out/` に出力する。

### パッケージ化

```bash
npm install -g @vscode/vsce  # 初回のみ
vsce package
```

`jp-selection-0.0.1.vsix` が生成される。

### VSCode へのインストール

```bash
code --install-extension jp-selection-0.0.1.vsix
```

インストール後は VSCode の再起動が必要な場合がある。再インストール時も同じコマンドで上書きされる。

---

## テスト

### 実行方法

```bash
npm test
```

VSCode なしで実行できる（mocha + ts-node。vscode モジュールはモックで差し替え）。

### テスト構成

| ファイル | 対象 | 内容 |
|---|---|---|
| `src/test/japaneseRanges.test.ts` | `japaneseRanges.ts` | 文字種判定・Unicode範囲・UTF-16ヘルパー |
| `src/test/selectionHandler.test.ts` | `selectionHandler.ts` | 選択拡張・境界トリムのロジック |
| `src/test/setup.ts` | — | vscode モジュールのモック登録 |

### テスト対象と主なケース

**`japaneseRanges.ts`**
- `isKanji` / `isHiragana` / `isKatakana`: 各文字種の正誤認識
- `isLongVowelMark`: ー (U+30FC) の判定
- `isSeparator`: 組み込み区切り範囲・追加区切り文字
- `getCharAt` / `getNextCharOffset` / `getPrevCharOffset`: サロゲートペアを含む UTF-16 オフセット処理

**`selectionHandler.ts`（`expandJapanese`）**
- 漢字・ひらがな・カタカナそれぞれの連続選択
- 長音符「ー」をひらがな・カタカナ両文脈で含める
- 異なる文字種・ASCII・CJK句読点での停止
- `additionalSeparators` による停止

**`selectionHandler.ts`（`trimAtJapaneseBoundary`）**
- 選択範囲の左右に日本語がある場合のトリム
- CJK句読点を境界として認識
- ASCII は境界にならないことの確認

---

## ファイル構成

```
jp_selection/
├── src/
│   ├── extension.ts              # エントリーポイント
│   ├── selectionHandler.ts       # ダブルクリック検出・選択ロジック
│   ├── japaneseRanges.ts         # Unicode 範囲定義・文字種判定
│   ├── config.ts                 # 設定読み込み
│   └── test/
│       ├── setup.ts              # vscode モジュールのモック
│       ├── japaneseRanges.test.ts
│       └── selectionHandler.test.ts
├── tsconfig.json                 # プロダクションビルド（src/test を除外）
├── tsconfig.test.json            # テスト用（src/test を含む）
├── .mocharc.json                 # mocha 設定
├── package.json
└── jp-selection.md               # 本仕様書
```
