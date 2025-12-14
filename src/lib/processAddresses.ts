import { OutputRow, AddressFlag } from '@/types';
import { normalize } from './normalize';
import { detectFormat } from './detectFormat';
import { parseAddress } from './parse';
import {
  verifyPostalCodeAsync,
  normalizePostalCode,
  preloadPostalData,
} from './postalLookup';

export interface ProcessOptions {
  enablePostalVerification?: boolean;
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

        // 正規化
        const normalized = normalize(address);

        // 形式判定
        const formatType = detectFormat(normalized);

        // パース
        const parsed = parseAddress(normalized, formatType);

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

        return {
          original: address,
          normalized,
          format_type: formatType,
          prefecture: parsed.prefecture,
          city: parsed.city,
          town: parsed.town,
          number_block: parsed.number_block,
          building: parsed.building,
          room: parsed.room,
          postal_code: normalizedPostalCode,
          confidence,
          flags: allFlags.join('|'),
          suggestion: generateSuggestion(allFlags),
          label_line1,
          label_line2,
          _originalColumns: originalColumns,
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
 */
function checkLabelFlags(label_line1: string, label_line2: string): AddressFlag[] {
  const flags: AddressFlag[] = [];
  const combined = label_line1 + label_line2;

  // 英語チェック（半角英字 A-Za-z が含まれる）
  if (/[A-Za-z]/.test(combined)) {
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
function createEmptyResult(
  original: string,
  originalColumns: Record<string, string>,
  flags: AddressFlag[]
): OutputRow {
  return {
    original,
    normalized: '',
    format_type: 'unknown',
    prefecture: '',
    city: '',
    town: '',
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
  return '';
}
