/**
 * ゆうパックプリントR CSV出力
 */
import { OutputRow } from '@/types';
import {
  normalizeField,
  normalizePostalForExport,
  downloadCsv,
} from '../core';
import {
  YupackColumn,
  YupackSlipType,
  YupackCodType,
  YupackHonorificType,
  YupackZeroColumns,
} from './schema';

// =====================================================
// 住所生成
// =====================================================

interface YupackAddress {
  address1: string;  // 都道府県
  address2: string;  // 市区町村〜番地
  address3: string;  // 空（address2に含める）
  address4: string;  // 建物+部屋
}

/**
 * ゆうパック用に住所を生成
 */
function generateYupackAddress(row: OutputRow): YupackAddress {
  const chomeStr = row.chome ? `${row.chome}丁目` : '';

  return {
    address1: normalizeField(row.prefecture),
    address2: [
      normalizeField(row.city),
      normalizeField(row.town),
      chomeStr,
      normalizeField(row.number_block),
    ].filter(Boolean).join(''),
    address3: '',
    address4: [
      normalizeField(row.building),
      normalizeField(row.room),
    ].filter(Boolean).join(''),
  };
}

// =====================================================
// CSV出力
// =====================================================

/**
 * ゆうパックプリントR用CSV出力（72列・ヘッダーなし）
 */
export function exportToYupackCsv(
  data: OutputRow[],
  filename: string = 'yupack.csv'
): void {
  const Col = YupackColumn;

  const rows = data.map((row) => {
    // 72列分の空配列を作成
    const values: string[] = new Array(Col.TOTAL_COLUMNS).fill('');

    // 固定値
    values[Col.SLIP_TYPE - 1] = YupackSlipType.YUPACK;
    values[Col.COD_TYPE - 1] = YupackCodType.PREPAID;
    values[Col.HONORIFIC_TYPE - 1] = YupackHonorificType.SAMA;

    // お届け先情報
    values[Col.DEST_NAME - 1] = row._name || '';
    values[Col.DEST_HONORIFIC - 1] = '様';
    values[Col.DEST_NAME_KANA - 1] = row._nameKana || '';
    values[Col.DEST_POSTAL - 1] = normalizePostalForExport(row.postal_code, false);

    const address = generateYupackAddress(row);
    values[Col.DEST_ADDRESS1 - 1] = address.address1;
    values[Col.DEST_ADDRESS2 - 1] = address.address2;
    values[Col.DEST_ADDRESS3 - 1] = address.address3;
    values[Col.DEST_ADDRESS4 - 1] = address.address4;
    values[Col.DEST_PHONE - 1] = row._phone?.formatted || '';

    // 0埋めが必要な列
    YupackZeroColumns.forEach(colNum => {
      values[colNum - 1] = '0';
    });

    return values;
  });

  // データ行のみ（ヘッダーなし）
  const csvContent = rows.map(r =>
    r.map(v => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v).join(',')
  ).join('\n');

  downloadCsv(csvContent, filename);
}
