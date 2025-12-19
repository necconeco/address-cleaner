/**
 * 佐川 e飛伝Ⅲ CSV出力
 */
import Papa from 'papaparse';
import { OutputRow } from '@/types';
import {
  normalizeField,
  normalizePostalForExport,
  toFullWidthAlphanumeric,
  splitByFullWidthLength,
  downloadCsv,
} from '../core';
import { SagawaEhidenHeaders, SagawaAddressLimit } from './schema';

// =====================================================
// 住所生成（全角変換+分割）
// =====================================================

interface SagawaAddress {
  address1: string;
  address2: string;
  address3: string;
}

/**
 * 佐川e飛伝Ⅲ用に住所を正規化
 * 1. 住所パーツを結合（都道府県〜部屋まで全部）
 * 2. 半角英数字→全角変換
 * 3. 全角48文字ずつ分割
 */
function generateSagawaAddress(row: OutputRow): SagawaAddress {
  const chomeStr = row.chome ? `${row.chome}丁目` : '';

  // 1. 住所パーツの結合（建物・部屋も含む）
  const fullAddress = [
    normalizeField(row.prefecture),
    normalizeField(row.city),
    normalizeField(row.town),
    chomeStr,
    normalizeField(row.number_block),
    normalizeField(row.building),
    normalizeField(row.room),
  ].filter(Boolean).join('');

  // 2. 半角英数字→全角変換
  const fullWidthAddress = toFullWidthAlphanumeric(fullAddress);

  // 3. 全角48文字ずつ分割
  const parts = splitByFullWidthLength(
    fullWidthAddress,
    SagawaAddressLimit.MAX_FULL_WIDTH_CHARS
  );

  return {
    address1: parts[0] || '',
    address2: parts[1] || '',
    address3: parts[2] || '',
  };
}

// =====================================================
// CSV出力
// =====================================================

/**
 * 佐川e飛伝Ⅲ用CSV出力
 */
export function exportToSagawaEhidenCsv(
  data: OutputRow[],
  filename: string = 'sagawa_ehiden3.csv'
): void {
  const rows = data.map((row) => {
    const { address1, address2, address3 } = generateSagawaAddress(row);

    return {
      'お届け先郵便番号': normalizePostalForExport(row.postal_code, true),
      'お届け先住所１': address1,
      'お届け先住所２': address2,
      'お届け先住所３': address3,
      'お届け先名称１': row._name || '',
      'お届け先名称２': '',
      'お届け先電話番号': row._phone?.formatted || '',
      'ご依頼主郵便番号': '',
      'ご依頼主住所１': '',
      'ご依頼主住所２': '',
      'ご依頼主名称１': '',
      'ご依頼主電話番号': '',
      '品名１': '',
      '荷姿': '',
      '重量': '',
      '指定日': '',
      '指定時間帯': '',
      '配達サービス': '',
    };
  });

  const csv = Papa.unparse(rows, {
    columns: [...SagawaEhidenHeaders],
    header: true,
  });

  downloadCsv(csv, filename);
}
