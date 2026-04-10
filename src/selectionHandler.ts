import * as vscode from 'vscode';
import {
  isJapanese,
  isKanji,
  isHiragana,
  isKatakana,
  isLongVowelMark,
  isSeparator,
  getCharAt,
  getNextCharOffset,
  getPrevCharOffset,
} from './japaneseRanges';
import { JpSelectionConfig } from './config';

interface ClickState {
  line: number;
  character: number;
  timestamp: number;
}

export class SelectionHandler {
  private lastEmptyClick: ClickState | null = null;
  private isProgrammaticChange = false;
  private config: JpSelectionConfig;

  constructor(config: JpSelectionConfig) {
    this.config = config;
  }

  updateConfig(config: JpSelectionConfig): void {
    this.config = config;
  }

  handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    // プログラム的な変更（自身による selection 更新）は無視して無限ループを防ぐ
    if (this.isProgrammaticChange) return;
    // マウス以外（キーボード・コマンド）の選択変更は無視
    if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
    // マルチカーソルは対象外
    if (event.selections.length !== 1) return;

    const selection = event.selections[0];

    if (selection.isEmpty) {
      // 空選択 = mousedown。位置とタイムスタンプを記録してダブルクリック判定に備える
      this.lastEmptyClick = {
        line: selection.active.line,
        character: selection.active.character,
        timestamp: Date.now(),
      };
      return;
    }

    if (this.lastEmptyClick === null) return;

    // ダブルクリック判定: 前回の空クリックから閾値内であること
    const elapsed = Date.now() - this.lastEmptyClick.timestamp;
    if (elapsed > this.config.doubleClickThresholdMs) {
      this.lastEmptyClick = null;
      return;
    }

    // 行が変わっている場合はスキップ
    if (selection.start.line !== this.lastEmptyClick.line) {
      this.lastEmptyClick = null;
      return;
    }

    // クリック位置が VSCode のデフォルト選択範囲内に収まっていることを確認
    const clickChar = this.lastEmptyClick.character;
    if (clickChar < selection.start.character || clickChar > selection.end.character) {
      this.lastEmptyClick = null;
      return;
    }

    const document = event.textEditor.document;
    const lineText = document.lineAt(this.lastEmptyClick.line).text;
    const clickedCh = getCharAt(lineText, clickChar);
    this.lastEmptyClick = null;

    let start: number;
    let end: number;

    if (isJapanese(clickedCh)) {
      // 日本語文字をクリック → 同種の日本語文字の連続を選択
      const expanded = this.expandJapanese(lineText, clickChar);
      if (expanded === null) return;
      [start, end] = expanded;
    } else {
      // 非日本語文字をクリック → VSCode のデフォルト選択を日本語境界でトリム
      const trimmed = this.trimAtJapaneseBoundary(
        lineText,
        selection.start.character,
        selection.end.character,
        clickChar,
      );
      if (trimmed === null) return;
      [start, end] = trimmed;
    }

    const newSelection = new vscode.Selection(
      new vscode.Position(selection.start.line, start),
      new vscode.Position(selection.start.line, end),
    );
    this.isProgrammaticChange = true;
    event.textEditor.selection = newSelection;
    this.isProgrammaticChange = false;
  }

  // 非日本語文字のダブルクリック用: VSCode デフォルト選択を日本語・CJK句読点境界でトリムする。
  // ASCII文字（U+0000–U+007F）は境界として扱わない（デフォルト動作に干渉しないため）。
  private trimAtJapaneseBoundary(
    lineText: string,
    selStart: number,
    selEnd: number,
    clickOffset: number,
  ): [number, number] | null {
    const { additionalSeparators } = this.config;
    const isBoundary = (ch: string) => {
      const cp = ch.codePointAt(0);
      // ASCII は境界扱いしない（VSCode デフォルトの区切り文字処理に委ねる）
      if (cp === undefined || cp < 0x80) return false;
      return isJapanese(ch) || isSeparator(ch, additionalSeparators);
    };

    // クリック位置より左側で最後に見つかった境界の直後を新しい開始位置とする
    let newStart = selStart;
    let pos = selStart;
    while (pos < clickOffset) {
      const ch = getCharAt(lineText, pos);
      const next = getNextCharOffset(lineText, pos);
      if (isBoundary(ch)) newStart = next;
      pos = next;
    }

    // クリック位置より右側で最初に見つかった境界を新しい終了位置とする
    let newEnd = selEnd;
    pos = getNextCharOffset(lineText, clickOffset);
    while (pos < selEnd) {
      const ch = getCharAt(lineText, pos);
      if (isBoundary(ch)) { newEnd = pos; break; }
      pos = getNextCharOffset(lineText, pos);
    }

    const changed = newStart !== selStart || newEnd !== selEnd;
    return changed ? [newStart, newEnd] : null;
  }

  // 日本語文字のダブルクリック用: クリックした文字種（漢字・ひらがな・カタカナ）の
  // 連続範囲を左右に拡張して返す。長音符（ー）はひらがな・カタカナ両方に含まれる。
  private expandJapanese(
    lineText: string,
    clickOffset: number,
  ): [number, number] | null {
    const { additionalSeparators } = this.config;
    const clickedCh = getCharAt(lineText, clickOffset);

    // クリックした文字種に応じて拡張条件を決定
    const matchFn: (ch: string) => boolean =
      isKanji(clickedCh) ? isKanji :
      isHiragana(clickedCh) ? (ch) => isHiragana(ch) || isLongVowelMark(ch) :
      isKatakana;  // カタカナ（長音符は KATAKANA_RANGES に含まれる）

    // クリック位置から左に拡張
    let start = clickOffset;
    while (start > 0) {
      const prevOffset = getPrevCharOffset(lineText, start);
      const prevChar = getCharAt(lineText, prevOffset);
      // !matchFn が文字種の境界を担うため、追加区切り文字のみチェックすれば十分
      const prevCp = prevChar.codePointAt(0);
      if (prevCp !== undefined && additionalSeparators.has(prevCp)) break;
      if (!matchFn(prevChar)) break;
      start = prevOffset;
    }

    // クリック位置から右に拡張
    let end = getNextCharOffset(lineText, clickOffset);
    while (end < lineText.length) {
      const ch = getCharAt(lineText, end);
      const cp = ch.codePointAt(0);
      if (cp !== undefined && additionalSeparators.has(cp)) break;
      if (!matchFn(ch)) break;
      end = getNextCharOffset(lineText, end);
    }

    if (start === end) return null;
    return [start, end];
  }
}
