import { AddressFlag, OutputRow } from '@/types';
import { BLOCKING_FLAGS, WARNING_FLAGS } from '@/constants/flags';
import { verifyPostalCode, normalizePostalCode } from './postalLookup';

// 部屋を示すキーワード（これがあれば単独数字は部屋番号の可能性が高い）
const ROOM_KEYWORDS = [
  '号室', '室', '号', 'F', '階', 'B1', 'B2', 'B3', '#', 'Room', 'Unit',
  'ルーム', 'フロア',
];

// 建物を示すキーワード（これがあれば単独数字は建物番号の可能性が高い）
const BUILDING_KEYWORDS = [
  'マンション', 'ビル', 'コーポ', 'ハイツ', 'レジデンス', 'タワー',
  'アパート', 'メゾン', 'パレス', 'グランド', 'ヒルズ', 'ガーデン',
  'プラザ', 'テラス', 'コート', 'ハウス', 'ホーム', 'シャトー',
  '荘', '寮', '館', '棟',
];

/**
 * 単独番地として許容できるかチェック
 * - number_blockが単独数字（例: "431", "5"）
 * - 部屋語・建物語が存在しない
 * - prefecture/city/town のいずれかが存在する
 */
function canAcceptSingleNumberBlock(row: OutputRow): boolean {
  const numberBlock = row.number_block || '';

  // 単独数字かチェック（数字のみ、ハイフンなし）
  if (!/^\d+$/.test(numberBlock)) {
    return false;
  }

  // 地名要素が存在するかチェック
  if (!row.prefecture && !row.city && !row.town) {
    return false;
  }

  // 元の住所に部屋語が含まれていないかチェック
  const original = row.original || '';
  const hasRoomKeyword = ROOM_KEYWORDS.some(keyword =>
    original.includes(keyword)
  );
  if (hasRoomKeyword) {
    return false;
  }

  // 元の住所に建物語が含まれていないかチェック
  const hasBuildingKeyword = BUILDING_KEYWORDS.some(keyword =>
    original.includes(keyword)
  );
  if (hasBuildingKeyword) {
    return false;
  }

  return true;
}

// 編集では変更されない（初回パース時のみ設定）フラグ
// 注意: POSTAL_MISMATCHは住所編集で解消される可能性があるため含めない
const PRESERVE_FLAGS: AddressFlag[] = [
  'PLACEHOLDER_ADDRESS',
  'UNKNOWN_FORMAT',
  'HAS_FLOAT_PREFIX',
  'NEED_REVIEW_PREFECTURE',
  'NEED_REVIEW_CITY',
  'NEED_REVIEW_NUMBER',
  'NEED_REVIEW_BUILDING',
  'NEED_REVIEW_ROOM_BUILDING',
  'NEED_REVIEW_TOWN',
  'PREF_MISMATCH_SUSPECT',
  'HAS_NON_ADDRESS_TOKENS',
  'PARSE_ERROR',
  'POSTAL_INVALID_FORMAT',
  'POSTAL_NOT_FOUND',
  // 'POSTAL_MISMATCH', // 住所編集で解消されるため除外
  'POSTAL_MULTI_TOWN',
  'AUTO_COMPLETED_FROM_POSTAL',
  'NEED_CUSTOMER_CONFIRM', // 顧客確認フラグは明示的に解除されるまで保持
];

/**
 * 編集後のフィールドからflagsを完全に再評価する
 * - AUTO_CLEARABLE_FLAGS: フィールドの状態に応じて再判定
 * - PRESERVE_FLAGS: 既存フラグを引き継ぐ（初回パース時の情報を保持）
 * - ENGLISH_BUILDING_ACCEPTED: 許容フラグとして引き継ぐ
 * - NEED_CUSTOMER_CONFIRM: customerConfirmReasonがあれば追加
 */
export function revalidateFlags(row: OutputRow, customerConfirmReason?: string): {
  flags: string;
  label_line1: string;
  label_line2: string;
  confidence: number;
} {
  const newFlags: AddressFlag[] = [];

  // 既存フラグから引き継ぐべきフラグを取得
  const existingFlags = row.flags ? row.flags.split('|').filter(Boolean) as AddressFlag[] : [];
  const hasEnglishBuildingAccepted = existingFlags.includes('ENGLISH_BUILDING_ACCEPTED');

  // PRESERVE_FLAGSを引き継ぐ（ただし条件付きで解除するものもある）
  for (const flag of existingFlags) {
    if (PRESERVE_FLAGS.includes(flag)) {
      // 特定のフラグは条件が解消されたら除外
      if (flag === 'NEED_REVIEW_CITY' && row.city && !/[A-Za-z]/.test(row.city)) {
        // 市区町村が日本語のみになったら解除
        continue;
      }
      if (flag === 'NEED_REVIEW_NUMBER' && row.number_block && /^[\d\-ー−]+$/.test(row.number_block)) {
        // 番地が数字とハイフンのみになったら解除
        continue;
      }
      if (flag === 'NEED_REVIEW_BUILDING' && row.building && !/[A-Za-z]/.test(row.building)) {
        // 建物名が日本語のみになったら解除
        continue;
      }
      if (flag === 'NEED_REVIEW_ROOM_BUILDING') {
        // 部屋と建物が明確に分かれたら解除（両方に値があれば解除）
        if (row.building && row.room) {
          continue;
        }
      }
      if (flag === 'NEED_REVIEW_TOWN' && row.town && row.town.length > 0) {
        // 町域が入力されたら解除
        continue;
      }
      newFlags.push(flag);
    }
  }

  // === 自動判定フラグ ===

  // 必須フィールドチェック
  if (!row.prefecture) {
    newFlags.push('MISSING_PREFECTURE');
  }
  if (!row.city) {
    newFlags.push('MISSING_CITY');
  }
  if (!row.number_block) {
    newFlags.push('MISSING_NUMBER_BLOCK');
  }

  // 単独番地の許容チェック
  // NUMBER_BLOCK_SINGLE_ACCEPTEDを引き継ぐか、新たに条件を満たすか
  const hadSingleAccepted = existingFlags.includes('NUMBER_BLOCK_SINGLE_ACCEPTED');
  if (hadSingleAccepted || canAcceptSingleNumberBlock(row)) {
    newFlags.push('NUMBER_BLOCK_SINGLE_ACCEPTED');
  }

  // POSTAL_MISMATCHを再評価（郵便番号があり、住所が入力されている場合）
  if (row.postal_code && normalizePostalCode(row.postal_code).length === 7) {
    const postalResult = verifyPostalCode(
      row.postal_code,
      row.prefecture || '',
      row.city || '',
      row.town || ''
    );
    // verifyPostalCodeが辞書未読み込みで空の場合は、既存のPOSTAL_MISMATCHを保持
    if (postalResult.flags.length === 0 && postalResult.candidates.length === 0) {
      // 辞書未読み込み - 既存フラグを確認
      if (existingFlags.includes('POSTAL_MISMATCH')) {
        // 既存のPOSTAL_MISMATCHがあっても、住所が変更されていれば除去する可能性がある
        // ただし辞書なしでは判断できないため保持
        newFlags.push('POSTAL_MISMATCH');
      }
    } else if (postalResult.flags.includes('POSTAL_MISMATCH')) {
      // 辞書読み込み済みで不一致 - フラグを追加
      newFlags.push('POSTAL_MISMATCH');
    }
    // 辞書読み込み済みで一致 - POSTAL_MISMATCHは追加しない（解消）
  }
  // 郵便番号が空の場合 - POSTAL_MISMATCHは追加しない（解消）

  // 顧客確認フラグを追加（customerConfirmReasonがあれば）
  if (customerConfirmReason && customerConfirmReason.trim()) {
    if (!newFlags.includes('NEED_CUSTOMER_CONFIRM')) {
      newFlags.push('NEED_CUSTOMER_CONFIRM');
    }
  }

  // ラベル生成
  const label_line1 = [
    row.prefecture,
    row.city,
    row.town,
    row.number_block,
  ]
    .filter(Boolean)
    .join('');

  const label_line2 = [row.building, row.room]
    .filter(Boolean)
    .join('');

  // ラベルチェック
  const combined = label_line1 + label_line2;

  // 英語チェック：住所部分（label_line1）のみ
  // 建物名（label_line2）の英語はヤマト運用でOKなのでチェック対象外
  if (/[A-Za-z]/.test(label_line1)) {
    newFlags.push('LABEL_HAS_ENGLISH');
  }

  // ENGLISH_BUILDING_ACCEPTED の引き継ぎ（履歴として残す）
  if (hasEnglishBuildingAccepted) {
    newFlags.push('ENGLISH_BUILDING_ACCEPTED');
  }

  // カンマチェック
  if (/[,，]/.test(combined)) {
    newFlags.push('LABEL_HAS_COMMA');
  }

  // 信頼度計算
  const confidence = calculateConfidence(row, newFlags);

  return {
    flags: newFlags.join('|'),
    label_line1,
    label_line2,
    confidence,
  };
}

/**
 * 信頼度を計算
 */
function calculateConfidence(
  row: OutputRow,
  flags: AddressFlag[]
): number {
  let score = 0;

  // 基本スコア
  if (row.prefecture) score += 0.3;
  if (row.city) score += 0.3;
  if (row.number_block) score += 0.2;
  if (row.town) score += 0.1;
  if (row.building || row.room) score += 0.1;

  // フラグによる減点
  const criticalFlags: AddressFlag[] = [
    'UNKNOWN_FORMAT',
    'MISSING_PREFECTURE',
    'MISSING_CITY',
  ];
  const hasCriticalFlag = flags.some((f) => criticalFlags.includes(f));
  if (hasCriticalFlag) {
    score *= 0.5;
  }

  // NEED_REVIEW系は軽微な減点
  const reviewFlags = flags.filter((f) => f.startsWith('NEED_REVIEW_'));
  score -= reviewFlags.length * 0.1;

  return Math.max(0, Math.min(1, score));
}

/**
 * 行が編集可能か（Blocking/Warningフラグがあるか）
 */
export function isRowEditable(row: OutputRow): boolean {
  if (!row.flags) return false;
  const flagList = row.flags.split('|').filter(Boolean) as AddressFlag[];
  return flagList.some(
    (f) => BLOCKING_FLAGS.includes(f) || WARNING_FLAGS.includes(f)
  );
}

/**
 * 英語建物名を許容できるかチェック
 * - LABEL_HAS_ENGLISHがある
 * - 建物名（building）に英語が含まれる
 * - 住所部分（label_line1）には英語がない
 */
export function canAcceptEnglishBuilding(row: OutputRow): boolean {
  if (!row.flags) return false;
  const flagList = row.flags.split('|').filter(Boolean) as AddressFlag[];

  // LABEL_HAS_ENGLISHがない場合は対象外
  if (!flagList.includes('LABEL_HAS_ENGLISH')) return false;

  // 既に許容済みの場合は対象外
  if (flagList.includes('ENGLISH_BUILDING_ACCEPTED')) return false;

  // 建物名に英語が含まれていない場合は対象外
  if (!/[A-Za-z]/.test(row.building || '')) return false;

  // 住所部分に英語が含まれている場合は対象外（住所の英語は許容不可）
  const label_line1 = [row.prefecture, row.city, row.town, row.number_block]
    .filter(Boolean)
    .join('');
  if (/[A-Za-z]/.test(label_line1)) return false;

  return true;
}

/**
 * 英語建物名を許容する（フラグを更新）
 */
export function acceptEnglishBuilding(row: OutputRow): {
  flags: string;
  confidence: number;
} {
  const existingFlags = row.flags ? row.flags.split('|').filter(Boolean) as AddressFlag[] : [];

  // LABEL_HAS_ENGLISHを除去し、ENGLISH_BUILDING_ACCEPTEDを追加
  const newFlags = existingFlags.filter((f) => f !== 'LABEL_HAS_ENGLISH');
  newFlags.push('ENGLISH_BUILDING_ACCEPTED');

  // 信頼度を再計算（LABEL_HAS_ENGLISHがなくなったので）
  const confidence = calculateConfidence(row, newFlags);

  return {
    flags: newFlags.join('|'),
    confidence,
  };
}
