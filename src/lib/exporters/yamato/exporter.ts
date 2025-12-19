/**
 * ヤマトB2クラウド CSV出力
 */
import Papa from 'papaparse';
import { OutputRow } from '@/types';
import {
  cleanString,
  normalizePostalForExport,
  generateCanonicalAddress,
  generateCanonicalApartment,
  downloadCsv,
} from '../core';
import {
  YamatoNekoposColumn,
  YamatoSlipType,
  YamatoSimpleColumns,
  YamatoNekoposHeaders,
} from './schema';

// =====================================================
// エクスポートオプション
// =====================================================

export interface YamatoExportOptions {
  postalWithHyphen?: boolean;
}

// =====================================================
// ネコポス95列 CSV出力
// =====================================================

/**
 * ネコポス用95列CSVを出力
 */
export function exportToYamatoB2FullCsv(
  data: OutputRow[],
  filename: string = 'yamato_b2_nekopos.csv'
): void {
  const Col = YamatoNekoposColumn;

  const rows = data.map((row) => {
    // 95列分の空配列を作成（0始まりなので列番号-1でアクセス）
    const values: string[] = new Array(Col.TOTAL_COLUMNS).fill('');

    // 送り状種類: ネコポス
    values[Col.SLIP_TYPE - 1] = YamatoSlipType.NEKOPOS;

    // お届け先情報
    values[Col.DEST_PHONE - 1] = row._phone?.formatted || '';
    values[Col.DEST_POSTAL - 1] = normalizePostalForExport(row.postal_code, true);
    values[Col.DEST_ADDRESS - 1] = generateCanonicalAddress(row);
    values[Col.DEST_APARTMENT - 1] = generateCanonicalApartment(row);
    values[Col.DEST_NAME - 1] = row._name || '';
    values[Col.DEST_NAME_KANA - 1] = row._nameKana || '';

    return values;
  });

  // ヘッダー行 + データ行
  const csvContent = [
    YamatoNekoposHeaders.join(','),
    ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadCsv(csvContent, filename);
}

// =====================================================
// 簡易版13列 CSV出力
// =====================================================

/**
 * 簡易版13列CSVを出力
 */
export function exportToYamatoB2Csv(
  data: OutputRow[],
  originalColumns: string[],
  filename: string = 'yamato_b2.csv',
  options: YamatoExportOptions = {}
): void {
  const { postalWithHyphen = false } = options;

  // 名前・電話番号列を自動検出
  const nameColumn = originalColumns.find(col =>
    col.includes('名前') || col.includes('氏名') || col.toLowerCase().includes('name')
  );
  const phoneColumn = originalColumns.find(col =>
    col.includes('電話') || col.includes('TEL') || col.toLowerCase().includes('phone')
  );

  const rows = data.map((row) => {
    const result: Record<string, string> = {
      'お届け先郵便番号': normalizePostalForExport(row.postal_code, postalWithHyphen),
      'お届け先住所': generateCanonicalAddress(row),
      'お届け先アパートマンション名': generateCanonicalApartment(row),
      'お届け先名': '',
      'お届け先電話番号': '',
      'ご依頼主郵便番号': '',
      'ご依頼主住所': '',
      'ご依頼主アパートマンション名': '',
      'ご依頼主名': '',
      'ご依頼主電話番号': '',
      '品名': '',
      '発送予定日': '',
      '送り状種類': YamatoSlipType.TAKKYUBIN,
    };

    // 元データから名前・電話番号を補完
    if (nameColumn && row._originalColumns?.[nameColumn]) {
      result['お届け先名'] = cleanString(row._originalColumns[nameColumn]);
    }
    if (phoneColumn && row._originalColumns?.[phoneColumn]) {
      result['お届け先電話番号'] = cleanString(row._originalColumns[phoneColumn]);
    }

    return result;
  });

  const csv = Papa.unparse(rows, {
    columns: [...YamatoSimpleColumns],
    header: true,
  });

  downloadCsv(csv, filename);
}
