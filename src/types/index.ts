// 形式タイプ
export type FormatType = 'google_maps' | 'japanese_full' | 'unknown';

// フラグ種別
export type AddressFlag =
  | 'MISSING_ADDRESS'
  | 'PLACEHOLDER_ADDRESS'
  | 'UNKNOWN_FORMAT'
  | 'HAS_FLOAT_PREFIX'
  | 'MISSING_PREFECTURE'
  | 'MISSING_CITY'
  | 'MISSING_NUMBER_BLOCK'
  | 'NEED_REVIEW_PREFECTURE'
  | 'NEED_REVIEW_CITY'
  | 'NEED_REVIEW_NUMBER'
  | 'NEED_REVIEW_BUILDING'
  | 'NEED_REVIEW_ROOM_BUILDING'
  | 'PREF_MISMATCH_SUSPECT'
  | 'HAS_NON_ADDRESS_TOKENS'
  | 'PARSE_ERROR'
  | 'POSTAL_INVALID_FORMAT'
  | 'POSTAL_NOT_FOUND'
  | 'POSTAL_MISMATCH'
  | 'POSTAL_MULTI_TOWN'
  | 'LABEL_HAS_ENGLISH'
  | 'LABEL_HAS_COMMA';

// パース結果
export interface ParsedAddress {
  original: string;
  normalized: string;
  format_type: FormatType;
  prefecture: string;
  city: string;
  town: string;
  number_block: string;
  building: string;
  room: string;
  postal_code: string;
  confidence: number;
  flags: string;
  suggestion: string;
  label_line1: string;
  label_line2: string;
}

// 入力行（元CSVの列を含む）
export interface InputRow {
  [key: string]: string;
}

// 出力行（元列＋パース結果）
export interface OutputRow extends ParsedAddress {
  _originalColumns?: Record<string, string>;
}

// フィルタ状態
export interface FilterState {
  showOnlyFlagged: boolean;
  formatType: FormatType | 'all';
  quickFilter: AddressFlag | null;
}

// 処理結果サマリー
// OK = blocking 0 かつ warning 0
// 要確認 = blocking 0 かつ warning > 0
// エラー = blocking > 0
export interface ProcessingSummary {
  total: number;
  ok: number;
  needsReview: number;
  error: number;
  successRate: number;
}
