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
  | 'POSTAL_AMBIGUOUS'
  | 'LABEL_HAS_ENGLISH'
  | 'LABEL_HAS_COMMA'
  | 'ENGLISH_BUILDING_ACCEPTED'
  | 'NEED_REVIEW_TOWN'
  | 'AUTO_COMPLETED_FROM_POSTAL'
  | 'NUMBER_BLOCK_SINGLE_ACCEPTED'
  | 'NEED_CUSTOMER_CONFIRM'
  | 'PHONE_IN_NUMBER_BLOCK'
  | 'AUTO_ZERO_RESTORED_MOBILE'
  | 'NEED_REVIEW_PHONE';

// パース結果
export interface ParsedAddress {
  original: string;
  normalized: string;
  format_type: FormatType;
  prefecture: string;
  city: string;
  town: string;
  chome: string;  // 丁目（数字のみ、例: "2"）
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
  __rowId: string;
  _originalColumns?: Record<string, string>;
  // 顧客確認が必要な場合の理由（編集可能）
  customerConfirmReason?: string;
  // 番地から検出された電話番号（移動先候補）
  _detectedPhone?: string;
  // 電話番号関連
  _phone?: {
    raw: string;
    digits: string;
    formatted: string;
    flags: string[];
  };
  _name?: string;
  _nameKana?: string;
}

// カテゴリタイプ
export type CategoryType = 'all' | 'empty' | 'needs_fix' | 'ok' | 'customer_confirm';

// フィルタ状態
export interface FilterState {
  showOnlyFlagged: boolean;
  formatType: FormatType | 'all';
  quickFilter: AddressFlag | null;
  category: CategoryType;
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

// 下書き（編集中の変更）
export type DraftFields = Partial<Pick<OutputRow,
  'prefecture' | 'city' | 'town' | 'chome' | 'number_block' | 'building' | 'room' | 'postal_code' | 'customerConfirmReason'
>>;

export type DraftRowsMap = Record<string, DraftFields>;
