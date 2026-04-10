// 漢字の Unicode 範囲
const KANJI_RANGES: [number, number][] = [
  [0x4E00, 0x9FFF], // CJK統合漢字
  [0x3400, 0x4DBF], // CJK拡張A
  [0xF900, 0xFAFF], // CJK互換漢字
];

// ひらがなの Unicode 範囲
const HIRAGANA_RANGES: [number, number][] = [
  [0x3041, 0x3096], // ぁ〜ゖ
];

// カタカナの Unicode 範囲（長音符・反復記号を含む）
const KATAKANA_RANGES: [number, number][] = [
  [0x30A1, 0x30FA], // ァ〜ヺ
  [0x30FC, 0x30FE], // ー（長音符）・ヽ・ヾ（反復記号）
];

// 選択の境界として扱う Unicode 範囲（この文字で選択が止まる）
const SEPARATOR_RANGES: [number, number][] = [
  [0x0000, 0x007F], // ASCII全体（空白・英数字・括弧・句読点）
  [0x3000, 0x3000], // 全角スペース
  [0x3001, 0x303F], // CJK記号・句読点（。、・「」…など）
  [0xFF00, 0xFFEF], // 半角・全角形（！－～など）
];

function codePointInRanges(cp: number, ranges: [number, number][]): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

export function isKanji(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && codePointInRanges(cp, KANJI_RANGES);
}

export function isHiragana(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && codePointInRanges(cp, HIRAGANA_RANGES);
}

export function isKatakana(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && codePointInRanges(cp, KATAKANA_RANGES);
}

// U+30FC: 長音符（ひらがな・カタカナどちらの選択にも含まれる）
export function isLongVowelMark(ch: string): boolean {
  return ch.codePointAt(0) === 0x30FC;
}

export function isJapanese(ch: string): boolean {
  return isKanji(ch) || isHiragana(ch) || isKatakana(ch);
}

export function isSeparator(ch: string, extraSeparators: Set<number>): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return true;
  if (extraSeparators.has(cp)) return true;
  return codePointInRanges(cp, SEPARATOR_RANGES);
}

// VSCode の Position.character は UTF-16 コードユニット単位のオフセット。
// サロゲートペアを正しく扱うためのヘルパー関数。

export function getCharAt(text: string, utf16Offset: number): string {
  const cp = text.codePointAt(utf16Offset);
  if (cp === undefined) return '';
  return String.fromCodePoint(cp);
}

export function getNextCharOffset(text: string, utf16Offset: number): number {
  const cp = text.codePointAt(utf16Offset);
  if (cp === undefined) return utf16Offset + 1;
  return utf16Offset + (cp > 0xFFFF ? 2 : 1);
}

export function getPrevCharOffset(text: string, utf16Offset: number): number {
  if (utf16Offset <= 0) return 0;
  // 直前のコードユニットがローサロゲートなら2ユニット戻る
  const prevUnit = text.charCodeAt(utf16Offset - 1);
  if (prevUnit >= 0xDC00 && prevUnit <= 0xDFFF) return utf16Offset - 2;
  return utf16Offset - 1;
}
