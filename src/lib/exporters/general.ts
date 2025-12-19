/**
 * 汎用CSV出力（解析結果、顧客確認用）
 */
import Papa from 'papaparse';
import { OutputRow } from '@/types';
import { cleanString, downloadCsv } from './core';

// =====================================================
// 解析結果CSV
// =====================================================

const RESULT_COLUMN_ORDER = [
  'original',
  'normalized',
  'format_type',
  'prefecture',
  'city',
  'town',
  'chome',
  'number_block',
  'building',
  'room',
  'postal_code',
  'confidence',
  'flags',
  'suggestion',
  'label_line1',
  'label_line2',
] as const;

/**
 * 解析結果をCSV出力
 */
export function exportToCsv(
  data: OutputRow[],
  originalColumns: string[],
  includeOriginalColumns: boolean,
  filename: string
): void {
  // 列順を構築
  const columns = [
    ...(includeOriginalColumns ? originalColumns : []),
    ...RESULT_COLUMN_ORDER,
  ];

  // データを整形
  const rows = data.map((row) => {
    const result: Record<string, string | number> = {};

    // 元列
    if (includeOriginalColumns && row._originalColumns) {
      originalColumns.forEach((col) => {
        result[col] = row._originalColumns?.[col] || '';
      });
    }

    // 結果列
    RESULT_COLUMN_ORDER.forEach((col) => {
      result[col] = row[col as keyof OutputRow] as string | number;
    });

    return result;
  });

  const csv = Papa.unparse(rows, {
    columns,
    header: true,
  });

  downloadCsv(csv, filename);
}

// =====================================================
// 顧客確認用CSV
// =====================================================

const CUSTOMER_CONFIRM_COLUMNS = [
  'email',
  '氏名',
  '元住所',
  '解析結果',
  '確認理由',
] as const;

/**
 * 顧客確認用CSV出力
 */
export function exportToCustomerConfirmCsv(
  data: OutputRow[],
  originalColumns: string[],
  filename: string = 'customer_confirm.csv'
): void {
  // メール・名前列を自動検出
  const emailColumn = originalColumns.find(col =>
    col.toLowerCase().includes('email') || col.toLowerCase().includes('mail') || col.includes('メール')
  );
  const nameColumn = originalColumns.find(col =>
    col.includes('名前') || col.includes('氏名') || col.toLowerCase().includes('name')
  );

  const rows = data.map((row) => {
    const parsedAddress = [
      row.prefecture,
      row.city,
      row.town,
      row.number_block,
      row.building,
      row.room,
    ].filter(Boolean).join(' ');

    return {
      'email': emailColumn && row._originalColumns?.[emailColumn]
        ? cleanString(row._originalColumns[emailColumn])
        : '',
      '氏名': nameColumn && row._originalColumns?.[nameColumn]
        ? cleanString(row._originalColumns[nameColumn])
        : '',
      '元住所': row.original || '',
      '解析結果': parsedAddress,
      '確認理由': row.customerConfirmReason || '',
    };
  });

  const csv = Papa.unparse(rows, {
    columns: [...CUSTOMER_CONFIRM_COLUMNS],
    header: true,
  });

  downloadCsv(csv, filename);
}
