/**
 * CSV出力の共通機能
 */
import { OutputRow } from '@/types';

// =====================================================
// 文字列正規化関数
// =====================================================

/**
 * 文字列をtrimして連続空白を除去
 */
export function cleanString(str: string | undefined | null): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * 住所フィールドを正規化する（出力用）
 * - NFKC正規化
 * - 全角英数字→半角
 * - 全角スペース→半角スペース
 * - ハイフン類を統一（長音符「ー」は保護）
 * - カタカナ間のハイフンを長音符に変換（ボヌ-ル → ボヌール）
 * - スペースは完全削除
 */
export function normalizeField(str: string | undefined | null): string {
  if (!str) return '';
  let result = str;

  // Unicode正規化（NFKC）
  result = result.normalize('NFKC');

  // 全角英数字→半角
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // 全角スペース→半角スペース
  result = result.replace(/　/g, ' ');

  // ハイフン類を統一（長音符「ー」は除外して保護）
  result = result.replace(/[−―–—‐‒]/g, '-');

  // カタカナ間のハイフンを長音符に変換
  result = result.replace(/([ァ-ヶ])-([ァ-ヶ])/g, '$1ー$2');

  // 前後と全スペースを削除
  result = result.trim().replace(/\s+/g, '');

  return result;
}

/**
 * 半角英数字を全角に変換
 */
export function toFullWidthAlphanumeric(str: string): string {
  if (!str) return '';
  return str.replace(/[0-9A-Za-z]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0xfee0);
  });
}

/**
 * 郵便番号を正規化
 */
export function normalizePostalForExport(
  str: string | undefined | null,
  withHyphen: boolean = false
): string {
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  const postal = digits.length >= 7 ? digits.slice(0, 7) : digits;

  if (withHyphen && postal.length === 7) {
    return `${postal.slice(0, 3)}-${postal.slice(3)}`;
  }
  return postal;
}

// =====================================================
// 住所生成関数
// =====================================================

/**
 * 正規形住所を生成（都道府県〜番地まで）
 */
export function generateCanonicalAddress(row: OutputRow): string {
  const chomeStr = row.chome ? `${row.chome}丁目` : '';

  return [
    normalizeField(row.prefecture),
    normalizeField(row.city),
    normalizeField(row.town),
    chomeStr,
    normalizeField(row.number_block),
  ].filter(Boolean).join('');
}

/**
 * 正規形建物名を生成（建物+部屋）
 */
export function generateCanonicalApartment(row: OutputRow): string {
  return [
    normalizeField(row.building),
    normalizeField(row.room),
  ].filter(Boolean).join('');
}

// =====================================================
// 全角換算分割（佐川用）
// =====================================================

/**
 * 全角換算で指定文字数ずつ分割
 */
export function splitByFullWidthLength(str: string, maxFullWidthChars: number): string[] {
  const result: string[] = [];
  let current = '';
  let currentLen = 0;

  for (const char of str) {
    const code = char.charCodeAt(0);
    const charLen = (code >= 0x20 && code <= 0x7e) ? 0.5 : 1;

    if (currentLen + charLen > maxFullWidthChars) {
      result.push(current);
      current = char;
      currentLen = charLen;
    } else {
      current += char;
      currentLen += charLen;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

// =====================================================
// CSVダウンロード
// =====================================================

/**
 * CSVをダウンロード（BOM付きUTF-8）
 */
export function downloadCsv(content: string, filename: string): void {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

// =====================================================
// 型定義
// =====================================================

/**
 * 配送業者の種類
 */
export type CarrierType = 'yamato' | 'sagawa' | 'yupack';

/**
 * 出力の種類
 */
export type ExportKind = 'nekopos' | 'simple' | 'ehiden3' | 'standard';

/**
 * エクスポートアクション
 */
export interface ExportAction {
  carrier: CarrierType | 'general';
  kind: ExportKind | 'all' | 'flagged' | 'customer_confirm';
}
