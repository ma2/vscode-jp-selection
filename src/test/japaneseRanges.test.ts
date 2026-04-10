import * as assert from 'assert';
import {
  isKanji,
  isHiragana,
  isKatakana,
  isLongVowelMark,
  isJapanese,
  isSeparator,
  getCharAt,
  getNextCharOffset,
  getPrevCharOffset,
} from '../japaneseRanges';

const noExtra = new Set<number>();

describe('isKanji', () => {
  it('CJK統合漢字を認識する', () => {
    assert.ok(isKanji('漢'));
    assert.ok(isKanji('字'));
    assert.ok(isKanji('日'));
  });
  it('ひらがな・カタカナを漢字と認識しない', () => {
    assert.ok(!isKanji('あ'));
    assert.ok(!isKanji('ア'));
    assert.ok(!isKanji('ー'));
  });
  it('ASCII を漢字と認識しない', () => {
    assert.ok(!isKanji('a'));
    assert.ok(!isKanji('1'));
  });
  it('CJK句読点を漢字と認識しない', () => {
    assert.ok(!isKanji('。'));
    assert.ok(!isKanji('、'));
  });
});

describe('isHiragana', () => {
  it('ひらがなを認識する', () => {
    assert.ok(isHiragana('あ'));
    assert.ok(isHiragana('ん'));
    assert.ok(isHiragana('ぁ')); // 小文字
    assert.ok(isHiragana('ゖ')); // U+3096 範囲末端
  });
  it('カタカナ・漢字をひらがなと認識しない', () => {
    assert.ok(!isHiragana('ア'));
    assert.ok(!isHiragana('漢'));
  });
  it('長音符をひらがなと認識しない（isLongVowelMark で扱う）', () => {
    assert.ok(!isHiragana('ー'));
  });
  it('ASCII をひらがなと認識しない', () => {
    assert.ok(!isHiragana('a'));
  });
});

describe('isKatakana', () => {
  it('カタカナを認識する', () => {
    assert.ok(isKatakana('ア'));
    assert.ok(isKatakana('ン'));
    assert.ok(isKatakana('ァ')); // 小文字
  });
  it('長音符（U+30FC）をカタカナと認識する', () => {
    assert.ok(isKatakana('ー'));
  });
  it('ひらがな・漢字をカタカナと認識しない', () => {
    assert.ok(!isKatakana('あ'));
    assert.ok(!isKatakana('漢'));
  });
});

describe('isLongVowelMark', () => {
  it('ー (U+30FC) を長音符と認識する', () => {
    assert.ok(isLongVowelMark('ー'));
  });
  it('他の文字を長音符と認識しない', () => {
    assert.ok(!isLongVowelMark('あ'));
    assert.ok(!isLongVowelMark('ア'));
    assert.ok(!isLongVowelMark('-')); // ASCII ハイフン
    assert.ok(!isLongVowelMark('ヽ')); // U+30FD 反復記号
  });
});

describe('isJapanese', () => {
  it('漢字・ひらがな・カタカナ・長音符を日本語と認識する', () => {
    assert.ok(isJapanese('漢'));
    assert.ok(isJapanese('あ'));
    assert.ok(isJapanese('ア'));
    assert.ok(isJapanese('ー'));
  });
  it('ASCII を日本語と認識しない', () => {
    assert.ok(!isJapanese('a'));
    assert.ok(!isJapanese('1'));
    assert.ok(!isJapanese(' '));
  });
  it('CJK句読点を日本語と認識しない', () => {
    assert.ok(!isJapanese('。'));
    assert.ok(!isJapanese('、'));
    assert.ok(!isJapanese('「'));
  });
});

describe('isSeparator', () => {
  it('ASCII を区切り文字と認識する', () => {
    assert.ok(isSeparator('a', noExtra));
    assert.ok(isSeparator(' ', noExtra));
    assert.ok(isSeparator('1', noExtra));
    assert.ok(isSeparator('(', noExtra));
  });
  it('全角スペースを区切り文字と認識する', () => {
    assert.ok(isSeparator('　', noExtra)); // U+3000
  });
  it('CJK句読点・括弧を区切り文字と認識する', () => {
    assert.ok(isSeparator('。', noExtra)); // U+3002
    assert.ok(isSeparator('、', noExtra)); // U+3001
    assert.ok(isSeparator('「', noExtra)); // U+300C
    assert.ok(isSeparator('」', noExtra)); // U+300D
  });
  it('漢字・ひらがな・カタカナを組み込み区切り文字と認識しない', () => {
    assert.ok(!isSeparator('漢', noExtra));
    assert.ok(!isSeparator('あ', noExtra));
    assert.ok(!isSeparator('ア', noExtra));
    assert.ok(!isSeparator('ー', noExtra));
  });
  it('追加区切り文字を認識する', () => {
    const extra = new Set(['_'.codePointAt(0)!]); // '_' は ASCII なので組み込みでも区切りだが追加でも動く
    assert.ok(isSeparator('_', extra));
  });
  it('追加区切り文字に漢字を指定した場合に認識する', () => {
    const extra = new Set(['中'.codePointAt(0)!]);
    assert.ok(isSeparator('中', extra));
    assert.ok(!isSeparator('漢', extra)); // 追加していない漢字は区切りでない
  });
});

describe('getCharAt', () => {
  it('BMP文字を返す', () => {
    assert.strictEqual(getCharAt('あいう', 0), 'あ');
    assert.strictEqual(getCharAt('あいう', 1), 'い');
    assert.strictEqual(getCharAt('あいう', 2), 'う');
  });
  it('サロゲートペアを1文字として返す', () => {
    const text = '𠀋'; // U+2000B（CJK拡張B）は UTF-16 で2コードユニット
    assert.strictEqual(getCharAt(text, 0), '𠀋');
    assert.strictEqual(getCharAt(text, 0).length, 2);
  });
  it('範囲外のオフセットに対して空文字を返す', () => {
    assert.strictEqual(getCharAt('あ', 5), '');
  });
});

describe('getNextCharOffset', () => {
  it('BMP文字は1進む', () => {
    assert.strictEqual(getNextCharOffset('あいう', 0), 1);
    assert.strictEqual(getNextCharOffset('あいう', 1), 2);
  });
  it('サロゲートペアは2進む', () => {
    const text = '𠀋a'; // サロゲートペア(2) + ASCII(1)
    assert.strictEqual(getNextCharOffset(text, 0), 2);
    assert.strictEqual(getNextCharOffset(text, 2), 3);
  });
});

describe('getPrevCharOffset', () => {
  it('BMP文字は1戻る', () => {
    assert.strictEqual(getPrevCharOffset('あいう', 2), 1);
    assert.strictEqual(getPrevCharOffset('あいう', 1), 0);
  });
  it('サロゲートペアは2戻る', () => {
    const text = 'a𠀋'; // ASCII(1) + サロゲートペア(2)
    assert.strictEqual(getPrevCharOffset(text, 3), 1); // ローサロゲートの位置から2戻る
  });
  it('オフセット0では0を返す', () => {
    assert.strictEqual(getPrevCharOffset('あ', 0), 0);
  });
});
