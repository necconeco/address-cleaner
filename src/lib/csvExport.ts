import Papa from 'papaparse';
import { OutputRow } from '@/types';

// 結果列の順序
const RESULT_COLUMN_ORDER = [
  'original',
  'normalized',
  'format_type',
  'prefecture',
  'city',
  'town',
  'number_block',
  'building',
  'room',
  'postal_code',
  'confidence',
  'flags',
  'suggestion',
  'label_line1',
  'label_line2',
];

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

  // CSVに変換
  const csv = Papa.unparse(rows, {
    columns,
    header: true,
  });

  // BOM付きUTF-8でダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
