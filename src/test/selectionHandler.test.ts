import * as assert from 'assert';
import { SelectionHandler } from '../selectionHandler';
import { JpSelectionConfig } from '../config';

// テスト用の設定を生成する
function makeConfig(additionalChars = ''): JpSelectionConfig {
  const separators = new Set<number>();
  for (const ch of additionalChars) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) separators.add(cp);
  }
  return { additionalSeparators: separators, doubleClickThresholdMs: 400 };
}

function makeHandler(additionalChars = ''): SelectionHandler {
  return new SelectionHandler(makeConfig(additionalChars));
}

// private メソッドへのアクセス（テスト用）
function expand(h: SelectionHandler, text: string, offset: number): [number, number] | null {
  return (h as any).expandJapanese(text, offset);
}

function trim(
  h: SelectionHandler,
  text: string,
  selStart: number,
  selEnd: number,
  clickOffset: number,
): [number, number] | null {
  return (h as any).trimAtJapaneseBoundary(text, selStart, selEnd, clickOffset);
}

// ─── expandJapanese ────────────────────────────────────────────────────────

describe('expandJapanese: 漢字', () => {
  it('連続する漢字を選択する', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, '日本語', 0), [0, 3]);
  });
  it('中間の文字から両方向に拡張する', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, '日本語', 1), [0, 3]);
  });
  it('単一漢字を選択する', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, '日', 0), [0, 1]);
  });
  it('ひらがなで止まる', () => {
    const h = makeHandler();
    // '日本語のテスト': 漢字3 + ひらがな + カタカナ3
    assert.deepStrictEqual(expand(h, '日本語のテスト', 0), [0, 3]);
  });
  it('カタカナで止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'テスト日本語', 3), [3, 6]);
  });
  it('ASCII で止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, '日本語test', 0), [0, 3]);
  });
  it('CJK句読点で止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, '日本語。漢字', 0), [0, 3]);
  });
});

describe('expandJapanese: ひらがな', () => {
  it('連続するひらがなを選択する', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'ひらがな', 0), [0, 4]);
  });
  it('長音符（ー）を含む', () => {
    const h = makeHandler();
    // 'らーめん': ひらがな + ー + ひらがな2
    assert.deepStrictEqual(expand(h, 'らーめん', 0), [0, 4]);
  });
  it('カタカナで止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'ひらがなテスト', 0), [0, 4]);
  });
  it('漢字で止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'ひらがな漢字', 0), [0, 4]);
  });
});

describe('expandJapanese: カタカナ', () => {
  it('連続するカタカナを選択する', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'テスト', 0), [0, 3]);
  });
  it('長音符（ー）を含む', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'コーヒー', 0), [0, 4]);
  });
  it('長音符の位置からカタカナ全体に拡張する', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'コーヒー', 1), [0, 4]); // offset 1 は ー
  });
  it('ひらがなで止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, 'テストのため', 0), [0, 3]);
  });
  it('漢字で止まる', () => {
    const h = makeHandler();
    assert.deepStrictEqual(expand(h, '漢字テスト', 2), [2, 5]);
  });
});

describe('expandJapanese: 追加区切り文字', () => {
  it('additionalSeparators に指定した漢字で止まる', () => {
    const h = makeHandler('中');
    // '日本中国': '中' で右への拡張が止まる
    assert.deepStrictEqual(expand(h, '日本中国', 0), [0, 2]);
  });
  it('additionalSeparators に指定したひらがなで止まる', () => {
    const h = makeHandler('の');
    assert.deepStrictEqual(expand(h, 'あいのうえ', 0), [0, 2]);
  });
});

// ─── trimAtJapaneseBoundary ────────────────────────────────────────────────

describe('trimAtJapaneseBoundary', () => {
  it('選択範囲の右側に漢字があればそこで止める', () => {
    const h = makeHandler();
    // 'abc漢字': 'b' をクリック (offset=1)、VSCode が [0,5) を選択した場合
    // 右スキャン: offset 2 ('c') → 通過、offset 3 ('漢') → 境界 → end=3
    assert.deepStrictEqual(trim(h, 'abc漢字', 0, 5, 1), [0, 3]);
  });
  it('選択範囲の左側に漢字があればそこでトリムする', () => {
    const h = makeHandler();
    // '漢字abc': 'b' をクリック (offset=4)、VSCode が [0,5) を選択した場合
    // 左スキャン: '漢' 境界 → newStart=1、'字' 境界 → newStart=2
    assert.deepStrictEqual(trim(h, '漢字abc', 0, 5, 4), [2, 5]);
  });
  it('選択範囲内に日本語がなければ変更しない（null を返す）', () => {
    const h = makeHandler();
    assert.strictEqual(trim(h, 'hello world', 0, 5, 2), null);
  });
  it('CJK句読点を境界として認識する', () => {
    const h = makeHandler();
    // 'abc。def': 'b' をクリック (offset=1)、選択が [0,7) の場合
    // 右: '。' が境界 → end=3
    assert.deepStrictEqual(trim(h, 'abc。def', 0, 7, 1), [0, 3]);
  });
  it('ASCII 文字は境界にならない', () => {
    const h = makeHandler();
    // 'abc def': スペース (ASCII) は境界にならない
    // 選択が [0,3) で日本語がなければ null
    assert.strictEqual(trim(h, 'abc def', 0, 3, 1), null);
  });
  it('additionalSeparators の非日本語文字（ASCII）は isSeparator 経由で認識する', () => {
    // ASCII は cp < 0x80 ガードで除外されるため、ASCII の additionalSeparators は効かない
    const h = makeHandler('_');
    // '_abc_': VSCode が [0,5) を選択、'b' をクリック (offset=2)
    // '_' は ASCII なので境界にならない → 変化なし
    assert.strictEqual(trim(h, '_abc_', 0, 5, 2), null);
  });
});
