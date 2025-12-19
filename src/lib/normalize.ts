/**
 * 住所を正規化する
 */
export function normalize(address: string): string {
  let result = address;

  // Unicode正規化（NFKC）
  result = result.normalize('NFKC');

  // 全角英数字→半角（NFKCで処理済みだが念のため）
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // 全角スペース→半角スペース（NFKCで変換されるが念のため）
  result = result.replace(/　/g, ' ');

  // ハイフン類を統一（長音符「ー」は除外して保護）
  // −: 全角マイナス(U+2212), ―: ダッシュ(U+2015), –: ENダッシュ(U+2013)
  // —: EMダッシュ(U+2014), ‐: ハイフン(U+2010), ‒: フィギュアダッシュ(U+2012)
  result = result.replace(/[−―–—‐‒]/g, '-');

  // カタカナ間のハイフンを長音符に変換（ボヌ-ル → ボヌール）
  result = result.replace(/([ァ-ヶ])-([ァ-ヶ])/g, '$1ー$2');

  // 連続スペースを1つに
  result = result.replace(/\s+/g, ' ');

  // 前後のスペースを除去
  result = result.trim();

  // 郵便番号の整形（7桁をNNN-NNNNに）
  result = result.replace(/(\d{3})(\d{4})(?!\d)/g, '$1-$2');

  return result;
}

/**
 * 郵便番号を抽出する
 */
export function extractPostalCode(address: string): string | null {
  // NNN-NNNN または NNNNNNN
  const match = address.match(/\d{3}-\d{4}/);
  return match ? match[0] : null;
}

/**
 * 住所文字列から郵便番号トークンを除去する
 * パターン:
 * - 〒123-4567 / 〒1234567
 * - 123-4567 / 1234567（7桁連続で住所前後にある場合）
 * - T123-4567（Tは〒の代用）
 *
 * @param address 住所文字列
 * @param hasPostalColumn postal_code列が別途存在するかどうか
 */
export function removePostalCodeToken(address: string, hasPostalColumn: boolean = false): string {
  let result = address;

  // 〒付きは必ず除去
  // 〒123-4567, 〒1234567, 〒 123-4567 等
  result = result.replace(/〒\s*\d{3}[- ]?\d{4}/g, '');

  // T + 郵便番号パターン（〒の代用）
  result = result.replace(/[TＴ]\s*\d{3}[- ]?\d{4}/g, '');

  // postal_code列がある場合のみ、住所内の7桁数字も除去
  // （列がない場合は郵便番号として残す必要があるため）
  if (hasPostalColumn) {
    // 住所文字列の先頭または末尾にある郵便番号パターンを除去
    // 先頭: 1234567 東京都... / 123-4567 東京都...
    result = result.replace(/^\s*\d{3}[- ]?\d{4}\s*/g, '');
    // 末尾: ...区 1234567 / ...区 123-4567
    result = result.replace(/\s*\d{3}[- ]?\d{4}\s*$/g, '');
  }

  // 連続スペースを1つに
  result = result.replace(/\s+/g, ' ');

  return result.trim();
}

/**
 * 北海道の郵便番号の先頭ゼロを補完する
 * CSVでExcel等により先頭の0が消えた場合の対策
 * @param postalCode 郵便番号（0落ちしている可能性あり）
 * @param address 住所文字列（北海道判定に使用）
 * @returns 補完された郵便番号
 */
export function fixHokkaidoPostalCode(postalCode: string, address: string): string {
  // 北海道でない場合はそのまま返す
  if (!address.includes('北海道')) {
    return postalCode;
  }

  // ハイフンを除去して数字のみにする
  const digits = postalCode.replace(/-/g, '');

  // 既に7桁ならそのまま返す
  if (digits.length >= 7) {
    return postalCode;
  }

  // 7桁になるまで先頭に0を追加
  const paddedDigits = digits.padStart(7, '0');

  // NNN-NNNN形式に整形
  return `${paddedDigits.slice(0, 3)}-${paddedDigits.slice(3)}`;
}

/**
 * 丁目を正規化する（数字のみに変換）
 * 入力例: "2", "2丁目", "二丁目", "２丁目"
 * 出力: "2"
 */
export function normalizeChome(input: string | undefined | null): string {
  if (!input) return '';

  let result = String(input).trim();

  // 全角数字→半角
  result = result.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // 漢数字→算用数字
  const kanjiMap: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
  };
  for (const [kanji, num] of Object.entries(kanjiMap)) {
    result = result.replace(kanji, num);
  }

  // 「丁目」を除去
  result = result.replace(/丁目$/, '');

  // 数字のみを抽出
  const match = result.match(/\d+/);
  return match ? match[0] : '';
}

/**
 * 電話番号っぽいかどうか判定する
 * @param str 判定対象の文字列
 * @returns 電話番号と判定された場合は正規化された電話番号、そうでなければnull
 *
 * 電話番号の条件:
 * - 正規化後（NFKC、空白/ハイフン除去）が数字のみで10〜11桁
 * - 先頭が0
 * - +81から始まる場合は+81除去後が10〜11桁
 */
export function detectPhoneNumber(str: string | undefined | null): string | null {
  if (!str) return null;

  let normalized = str;

  // NFKC正規化
  normalized = normalized.normalize('NFKC');

  // 全角数字→半角
  normalized = normalized.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // +81対応（国際番号形式）
  const hasCountryCode = /^\+?81/.test(normalized);
  if (hasCountryCode) {
    // +81 または 81 を除去し、先頭に0を付ける
    normalized = normalized.replace(/^\+?81/, '0');
  }

  // 空白・ハイフン類・括弧を除去
  normalized = normalized.replace(/[\s\-−‐–—―()（）]/g, '');

  // 数字のみかチェック
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  // 10〜11桁かつ先頭が0
  if (normalized.length >= 10 && normalized.length <= 11 && normalized.startsWith('0')) {
    return normalized;
  }

  return null;
}
