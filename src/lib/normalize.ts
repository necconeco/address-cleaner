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

  // ハイフン類を統一
  result = result.replace(/[−ー―–—‐]/g, '-');

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
