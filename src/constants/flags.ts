import { AddressFlag } from '@/types';

// フラグの表示ラベル
export const FLAG_LABELS: Record<AddressFlag, string> = {
  MISSING_ADDRESS: '住所欠損',
  PLACEHOLDER_ADDRESS: 'プレースホルダ',
  UNKNOWN_FORMAT: '形式不明',
  HAS_FLOAT_PREFIX: '小数ノイズ',
  MISSING_PREFECTURE: '都道府県欠損',
  MISSING_CITY: '市区町村欠損',
  MISSING_NUMBER_BLOCK: '番地欠損',
  NEED_REVIEW_PREFECTURE: '都道府県要確認',
  NEED_REVIEW_CITY: '市区町村要確認',
  NEED_REVIEW_NUMBER: '番地要確認',
  NEED_REVIEW_BUILDING: '建物要確認',
  NEED_REVIEW_ROOM_BUILDING: '部屋/建物要確認',
  PREF_MISMATCH_SUSPECT: '都道府県矛盾疑い',
  HAS_NON_ADDRESS_TOKENS: '非住所トークン',
  PARSE_ERROR: 'パースエラー',
  POSTAL_INVALID_FORMAT: '郵便番号の形式がおかしい',
  POSTAL_NOT_FOUND: '郵便番号が見つからない',
  POSTAL_MISMATCH: '郵便番号と住所が一致しない',
  POSTAL_MULTI_TOWN: '町域が複数あり特定不可',
  LABEL_HAS_ENGLISH: 'ラベルに英語あり',
  LABEL_HAS_COMMA: 'ラベルにカンマあり',
};

// クイックフィルタ用フラグ
export const QUICK_FILTER_FLAGS: AddressFlag[] = [
  'MISSING_PREFECTURE',
  'MISSING_CITY',
  'MISSING_NUMBER_BLOCK',
  'UNKNOWN_FORMAT',
  'PLACEHOLDER_ADDRESS',
  'HAS_FLOAT_PREFIX',
  'POSTAL_MISMATCH',
  'POSTAL_NOT_FOUND',
];

// Blocking フラグ（エラー扱い：発送不可）
export const BLOCKING_FLAGS: AddressFlag[] = [
  'MISSING_ADDRESS',
  'PLACEHOLDER_ADDRESS',
  'UNKNOWN_FORMAT',
  'MISSING_PREFECTURE',
  'MISSING_CITY',
  'MISSING_NUMBER_BLOCK',
  'PARSE_ERROR',
];

// Warning フラグ（要確認：発送可能だが確認推奨）
export const WARNING_FLAGS: AddressFlag[] = [
  'NEED_REVIEW_PREFECTURE',
  'NEED_REVIEW_CITY',
  'NEED_REVIEW_NUMBER',
  'NEED_REVIEW_BUILDING',
  'NEED_REVIEW_ROOM_BUILDING',
  'HAS_FLOAT_PREFIX',
  'PREF_MISMATCH_SUSPECT',
  'HAS_NON_ADDRESS_TOKENS',
  'POSTAL_INVALID_FORMAT',
  'POSTAL_NOT_FOUND',
  'POSTAL_MISMATCH',
  'POSTAL_MULTI_TOWN',
  'LABEL_HAS_ENGLISH',
  'LABEL_HAS_COMMA',
];

/**
 * フラグを分類してカウントする
 */
export function classifyFlags(flags: string): {
  blocking: number;
  warning: number;
  blockingFlags: AddressFlag[];
  warningFlags: AddressFlag[];
} {
  if (!flags) {
    return { blocking: 0, warning: 0, blockingFlags: [], warningFlags: [] };
  }

  const flagList = flags.split('|').filter(Boolean) as AddressFlag[];
  const blockingFlags = flagList.filter((f) => BLOCKING_FLAGS.includes(f));
  const warningFlags = flagList.filter((f) => WARNING_FLAGS.includes(f));

  return {
    blocking: blockingFlags.length,
    warning: warningFlags.length,
    blockingFlags,
    warningFlags,
  };
}

// プレースホルダとして扱う文字列
export const PLACEHOLDER_PATTERNS = [
  'デフォルト住所',
  'default',
  'N/A',
  'n/a',
  'NA',
  'none',
  'null',
  'undefined',
  '-',
  '---',
  '該当なし',
  '不明',
];
