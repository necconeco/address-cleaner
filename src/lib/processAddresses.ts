import { OutputRow, AddressFlag } from '@/types';
import { normalize, removePostalCodeToken, fixHokkaidoPostalCode, normalizeChome } from './normalize';
import { detectFormat } from './detectFormat';
import { parseAddress } from './parse';
import {
  verifyPostalCodeAsync,
  normalizePostalCode,
  preloadPostalData,
} from './postalLookup';
import { normalizePhone } from './phone';

export interface ProcessOptions {
  enablePostalVerification?: boolean;
  acceptSingleNumber?: boolean;
}

// 列マッピング設定
export interface ColumnMappingConfig {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  chome: string;
  numberBlock: string;
  building: string;
  email: string;
  phone: string;
  name: string;
  nameKana: string;
}

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
 * 電話番号列の名前を特定する
 */
function findPhoneColumnName(columns: Record<string, string>): string | null {
  const phonePatterns = ['電話番号', '電話', 'TEL', 'tel', 'Phone', 'phone', '携帯', '連絡先'];
  for (const key of Object.keys(columns)) {
    if (phonePatterns.some(p => key.includes(p))) {
      return key;
    }
  }
  return null;
}

/**
 * 単独番地として許容できるかチェック
 */
function canAcceptSingleNumberBlock(
  original: string,
  numberBlock: string,
  prefecture: string,
  city: string,
  town: string
): boolean {
  // 単独数字かチェック（数字のみ、ハイフンなし）
  if (!/^\d+$/.test(numberBlock)) {
    return false;
  }

  // 地名要素が存在するかチェック
  if (!prefecture && !city && !town) {
    return false;
  }

  // 元の住所に部屋語が含まれていないかチェック
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

/**
 * 住所リストを処理する（非同期版）
 * @param addresses 住所文字列の配列
 * @param originalData 元CSVデータ
 * @param options 処理オプション
 */
export async function processAddresses(
  addresses: string[],
  originalData: Record<string, string>[] = [],
  options: ProcessOptions = {}
): Promise<OutputRow[]> {
  const { enablePostalVerification = false } = options;

  // 郵便番号照合が有効な場合、辞書を事前読み込み
  if (enablePostalVerification) {
    await preloadPostalData();
  }

  const results = await Promise.all(
    addresses.map(async (address, index) => {
      const originalColumns = originalData[index] || {};

      try {
        // 空欄チェック
        if (!address || address.trim() === '') {
          return createEmptyResult(address, originalColumns, ['MISSING_ADDRESS']);
        }

        // プレースホルダチェック
        if (isPlaceholder(address)) {
          return createEmptyResult(address, originalColumns, ['PLACEHOLDER_ADDRESS']);
        }

        // 先頭小数チェック
        const floatPrefixFlags: AddressFlag[] = [];
        if (/^\d+\.\d+,/.test(address)) {
          floatPrefixFlags.push('HAS_FLOAT_PREFIX');
        }

        // 住所文字列から郵便番号トークンを除去（postal_code列がある場合は積極的に除去）
        const hasPostalColumn = 'postal_code' in originalColumns || '郵便番号' in originalColumns;
        const addressWithoutPostal = removePostalCodeToken(address, hasPostalColumn);

        // 正規化
        const normalized = normalize(addressWithoutPostal);

        // 形式判定
        const formatType = detectFormat(normalized);

        // パース
        const parsed = parseAddress(normalized, formatType);

        // 北海道の郵便番号の先頭0を補完
        if (parsed.postal_code) {
          parsed.postal_code = fixHokkaidoPostalCode(parsed.postal_code, normalized);
        }

        // 郵便番号照合（有効な場合のみ）
        let postalFlags: AddressFlag[] = [];
        if (enablePostalVerification && parsed.postal_code) {
          const postalResult = await verifyPostalCodeAsync(
            parsed.postal_code,
            parsed.prefecture,
            parsed.city,
            parsed.town
          );
          postalFlags = postalResult.flags;
        }

        // フラグ結合
        const allFlags = [...floatPrefixFlags, ...parsed.flags, ...postalFlags];

        // 単独番地の許容チェック
        if (canAcceptSingleNumberBlock(
          address,
          parsed.number_block,
          parsed.prefecture,
          parsed.city,
          parsed.town
        )) {
          allFlags.push('NUMBER_BLOCK_SINGLE_ACCEPTED');
        }

        // 信頼度計算
        const confidence = calculateConfidence(parsed, allFlags);

        // 郵便番号の正規化（7桁ハイフンなし）
        const normalizedPostalCode = normalizePostalCode(parsed.postal_code);

        // ラベル生成
        const label_line1 = [
          parsed.prefecture,
          parsed.city,
          parsed.town,
          parsed.number_block,
        ]
          .filter(Boolean)
          .join('');

        const label_line2 = [parsed.building, parsed.room]
          .filter(Boolean)
          .join('');

        // ラベルチェック（発送見た目用）
        const labelFlags = checkLabelFlags(label_line1, label_line2);
        allFlags.push(...labelFlags);

        // 電話番号が検出された場合、I列（電話番号）への移動を試みる
        let updatedOriginalColumns = { ...originalColumns };
        if (parsed.detectedPhone) {
          // 電話番号列を特定（I列 = 「電話番号」列）
          const phoneColumnName = findPhoneColumnName(originalColumns);
          if (phoneColumnName) {
            const existingPhone = originalColumns[phoneColumnName];
            // 既存の電話番号が空の場合のみ移動
            if (!existingPhone || existingPhone.trim() === '') {
              updatedOriginalColumns = {
                ...originalColumns,
                [phoneColumnName]: parsed.detectedPhone,
              };
            }
          }
        }

        return {
          __rowId: `row-${index}-${Date.now()}`,
          original: address,
          normalized,
          format_type: formatType,
          prefecture: parsed.prefecture,
          city: parsed.city,
          town: parsed.town,
          chome: '',  // 1列住所解析モードでは未対応（空文字）
          number_block: parsed.number_block,
          building: parsed.building,
          room: parsed.room,
          postal_code: normalizedPostalCode,
          confidence,
          flags: allFlags.join('|'),
          suggestion: generateSuggestion(allFlags),
          label_line1,
          label_line2,
          _originalColumns: updatedOriginalColumns,
          _detectedPhone: parsed.detectedPhone,
        };
      } catch {
        return createEmptyResult(address, originalColumns, ['PARSE_ERROR']);
      }
    })
  );

  return results;
}

/**
 * ラベルの見た目チェック（発送用）
 * 注意: 建物名（label_line2）の英語はヤマト運用でOKなのでチェック対象外
 */
function checkLabelFlags(label_line1: string, label_line2: string): AddressFlag[] {
  const flags: AddressFlag[] = [];
  const combined = label_line1 + label_line2;

  // 英語チェック：住所部分（label_line1）のみ
  // 建物名（label_line2）の英語はヤマト運用でOK
  if (/[A-Za-z]/.test(label_line1)) {
    flags.push('LABEL_HAS_ENGLISH');
  }

  // カンマチェック（半角または全角カンマ）
  if (/[,，]/.test(combined)) {
    flags.push('LABEL_HAS_COMMA');
  }

  return flags;
}

/**
 * プレースホルダかどうか判定
 */
function isPlaceholder(address: string): boolean {
  const patterns = [
    'デフォルト住所',
    'default',
    'N/A',
    'n/a',
    'NA',
    'none',
    'null',
    'undefined',
    '該当なし',
    '不明',
  ];
  const normalized = address.trim().toLowerCase();
  return patterns.some(
    (p) => normalized === p.toLowerCase() || normalized === p
  );
}

/**
 * 空の結果を作成
 */
let emptyResultCounter = 0;
function createEmptyResult(
  original: string,
  originalColumns: Record<string, string>,
  flags: AddressFlag[]
): OutputRow {
  return {
    __rowId: `empty-${emptyResultCounter++}-${Date.now()}`,
    original,
    normalized: '',
    format_type: 'unknown',
    prefecture: '',
    city: '',
    town: '',
    chome: '',
    number_block: '',
    building: '',
    room: '',
    postal_code: '',
    confidence: 0,
    flags: flags.join('|'),
    suggestion: generateSuggestion(flags),
    label_line1: '',
    label_line2: '',
    _originalColumns: originalColumns,
  };
}

/**
 * 信頼度を計算
 */
function calculateConfidence(
  parsed: {
    prefecture: string;
    city: string;
    number_block: string;
  },
  flags: AddressFlag[]
): number {
  let score = 0;

  // 基本スコア
  if (parsed.prefecture) score += 0.3;
  if (parsed.city) score += 0.3;
  if (parsed.number_block) score += 0.2;

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

  // POSTAL_MISMATCH のみ軽く減点（-0.1）
  if (flags.includes('POSTAL_MISMATCH')) {
    score -= 0.1;
  }
  // POSTAL_MULTI_TOWN は減点しない（仕様上起こり得るWarning）

  return Math.max(0, Math.min(1, score));
}

/**
 * 提案メッセージを生成
 */
function generateSuggestion(flags: AddressFlag[]): string {
  if (flags.includes('MISSING_ADDRESS')) {
    return '住所を入力してください';
  }
  if (flags.includes('PLACEHOLDER_ADDRESS')) {
    return '正しい住所に置き換えてください';
  }
  if (flags.includes('UNKNOWN_FORMAT')) {
    return '形式を確認し、手動で分割してください';
  }
  if (flags.includes('MISSING_PREFECTURE')) {
    return '都道府県を補完してください';
  }
  if (flags.includes('MISSING_CITY')) {
    return '市区町村を補完してください';
  }
  if (flags.includes('NEED_REVIEW_CITY')) {
    return '市区町村を日本語に変換してください';
  }
  if (flags.includes('NEED_REVIEW_NUMBER')) {
    return '番地の区切りを確認してください';
  }
  if (flags.includes('NEED_REVIEW_ROOM_BUILDING')) {
    return '部屋番号と建物名を確認してください';
  }
  if (flags.includes('POSTAL_INVALID_FORMAT')) {
    return '郵便番号の形式を確認してください（7桁数字）';
  }
  if (flags.includes('POSTAL_NOT_FOUND')) {
    return '郵便番号が存在しないか誤りがあります';
  }
  if (flags.includes('POSTAL_MISMATCH')) {
    return '郵便番号と住所が一致しません。どちらかを確認してください';
  }
  if (flags.includes('POSTAL_MULTI_TOWN')) {
    return '複数町域に該当するため町域は特定不可（要確認）';
  }
  if (flags.includes('LABEL_HAS_ENGLISH')) {
    return 'ラベルに英語が含まれています。日本語に変換してください';
  }
  if (flags.includes('LABEL_HAS_COMMA')) {
    return 'ラベルにカンマが含まれています。削除してください';
  }
  if (flags.includes('PHONE_IN_NUMBER_BLOCK')) {
    return '番地に電話番号が混入しています。電話番号列へ移動してください';
  }
  return '';
}

/**
 * 列マッピング用：フィールドをNFKC正規化＋整形
 */
function normalizeFieldValue(value: string | undefined | null): string {
  if (!value) return '';
  let result = String(value).trim();

  // NFKC正規化
  result = result.normalize('NFKC');

  // 全角英数字→半角
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // 全角スペース→半角スペース
  result = result.replace(/　/g, ' ');

  // ハイフン類を統一（長音符「ー」は除外して保護）
  result = result.replace(/[−―–—‐‒]/g, '-');

  // カタカナ間のハイフンを長音符に変換（ボヌ-ル → ボヌール）
  result = result.replace(/([ァ-ヶ])-([ァ-ヶ])/g, '$1ー$2');

  // 連続スペースを1つに
  result = result.replace(/\s+/g, ' ');

  return result.trim();
}

/**
 * 列マッピング用：郵便番号を強化正規化
 * - 全角/半角変換
 * - ハイフン/スペース/〒除去
 * - 7桁数字のみ抽出
 */
function normalizePostalCodeStrict(value: string | undefined | null): { code: string; flags: AddressFlag[] } {
  const flags: AddressFlag[] = [];
  if (!value) return { code: '', flags: [] };

  let result = String(value).trim();

  // NFKC正規化
  result = result.normalize('NFKC');

  // 全角数字→半角
  result = result.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

  // 〒記号を除去
  result = result.replace(/〒/g, '');

  // ハイフン類・空白を除去
  result = result.replace(/[-ー−‐–—―\s]/g, '');

  // 数字のみ抽出
  result = result.replace(/\D/g, '');

  // 7桁未満の場合はフラグを立てる
  if (result.length > 0 && result.length < 7) {
    flags.push('POSTAL_NOT_FOUND');
  }

  // 7桁ちょうどのみ採用、それ以外は空文字
  if (result.length === 7) {
    return { code: result, flags: [] };
  }

  return { code: '', flags };
}

/**
 * 列マッピングされたCSVを処理する（正規表現パースをスキップ）
 */
export async function processColumnMappedAddresses(
  csvData: Record<string, string>[],
  mapping: ColumnMappingConfig,
  options: ProcessOptions = {}
): Promise<OutputRow[]> {
  const { enablePostalVerification = false } = options;

  // 郵便番号照合が有効な場合、辞書を事前読み込み
  if (enablePostalVerification) {
    await preloadPostalData();
  }

  const results = await Promise.all(
    csvData.map(async (row, index) => {
      try {
        const flags: AddressFlag[] = [];

        // 各フィールドを正規化して取得
        const prefecture = normalizeFieldValue(mapping.prefecture ? row[mapping.prefecture] : '');
        const city = normalizeFieldValue(mapping.city ? row[mapping.city] : '');
        const town = normalizeFieldValue(mapping.town ? row[mapping.town] : '');

        // 丁目の処理
        const chomeValue = mapping.chome ? row[mapping.chome] : '';
        const normalizedChome = normalizeChome(chomeValue);

        const numberBlock = normalizeFieldValue(mapping.numberBlock ? row[mapping.numberBlock] : '');
        const building = normalizeFieldValue(mapping.building ? row[mapping.building] : '');

        // 郵便番号の強化正規化
        const postalResult = normalizePostalCodeStrict(mapping.postalCode ? row[mapping.postalCode] : '');
        let postal_code = postalResult.code;
        flags.push(...postalResult.flags);

        // 北海道の郵便番号の先頭0を補完（都道府県がある場合）
        if (postal_code && prefecture) {
          // 郵便番号をハイフン付き形式に変換して補完処理
          const postalWithHyphen = postal_code.length === 7
            ? `${postal_code.slice(0, 3)}-${postal_code.slice(3)}`
            : postal_code;
          const fixed = fixHokkaidoPostalCode(postalWithHyphen, prefecture);
          // ハイフンを除去して7桁形式に戻す
          postal_code = fixed.replace(/-/g, '');
        }

        // 電話番号の処理
        const phoneValue = mapping.phone ? row[mapping.phone] : '';
        const normalizedPhone = normalizePhone(phoneValue);

        // 電話番号フラグをflagsに統合
        if (normalizedPhone.flags.length > 0) {
          flags.push(...normalizedPhone.flags);
        }

        // 空欄チェック
        if (!prefecture && !city && !town && !numberBlock) {
          return createEmptyResult('', row, ['MISSING_ADDRESS']);
        }

        // 必須フィールドのチェック
        if (!prefecture) {
          flags.push('MISSING_PREFECTURE');
        }
        if (!city) {
          flags.push('MISSING_CITY');
        }
        if (!numberBlock) {
          flags.push('MISSING_NUMBER_BLOCK');
        }

        // 郵便番号照合（有効な場合のみ）
        if (enablePostalVerification && postal_code) {
          const postalVerifyResult = await verifyPostalCodeAsync(
            postal_code,
            prefecture,
            city,
            town
          );
          flags.push(...postalVerifyResult.flags);
        }

        // 信頼度計算
        const confidence = calculateConfidence(
          { prefecture, city, number_block: numberBlock },
          flags
        );

        // ラベル生成
        const label_line1 = [prefecture, city, town, numberBlock]
          .filter(Boolean)
          .join('');

        const label_line2 = building;

        // ラベルチェック
        const labelFlags = checkLabelFlags(label_line1, label_line2);
        flags.push(...labelFlags);

        // 元住所を組み立て
        const original = [prefecture, city, town, numberBlock, building]
          .filter(Boolean)
          .join(' ');

        return {
          __rowId: `row-${index}-${Date.now()}`,
          original,
          normalized: original,
          format_type: 'japanese_full' as const,
          prefecture,
          city,
          town,
          chome: normalizedChome,
          number_block: numberBlock,
          building,
          room: '', // 列マッピングモードでは building に統合
          postal_code,
          confidence,
          flags: flags.join('|'),
          suggestion: generateSuggestion(flags),
          label_line1,
          label_line2,
          _originalColumns: row,
          _phone: {
            raw: normalizedPhone.raw,
            digits: normalizedPhone.digits,
            formatted: normalizedPhone.formatted,
            flags: normalizedPhone.flags,
          },
          _name: mapping.name ? row[mapping.name] : '',
          _nameKana: mapping.nameKana ? row[mapping.nameKana] : '',
        };
      } catch {
        return createEmptyResult('', row, ['PARSE_ERROR']);
      }
    })
  );

  return results;
}
