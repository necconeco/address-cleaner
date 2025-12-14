import { AddressFlag } from '@/types';

interface PostalEntry {
  prefecture: string;
  city: string;
  town: string;
}

type PostalCodeMap = Record<string, PostalEntry[]>;

// 遅延読み込み用のキャッシュ
let postalMap: PostalCodeMap | null = null;
let loadingPromise: Promise<PostalCodeMap> | null = null;

/**
 * 郵便番号辞書をオンデマンドで読み込む
 */
async function loadPostalData(): Promise<PostalCodeMap> {
  if (postalMap) {
    return postalMap;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = import('@/data/postalCode.json').then((module) => {
    postalMap = module.default as PostalCodeMap;
    return postalMap;
  });

  return loadingPromise;
}

export interface PostalLookupResult {
  flags: AddressFlag[];
  candidates: PostalEntry[];
}

/**
 * 郵便番号を正規化（ハイフン除去、7桁化）
 */
export function normalizePostalCode(postalCode: string): string {
  if (!postalCode) return '';
  // 全角を半角に
  let normalized = postalCode
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[ー−‐–—―]/g, '-');
  // ハイフン除去
  normalized = normalized.replace(/-/g, '');
  // 数字のみ抽出
  normalized = normalized.replace(/\D/g, '');
  return normalized;
}

/**
 * 郵便番号の形式チェック（7桁数字）
 */
export function isValidPostalFormat(postalCode: string): boolean {
  const normalized = normalizePostalCode(postalCode);
  return /^\d{7}$/.test(normalized);
}

/**
 * 郵便番号から住所候補を検索（同期版 - 辞書読み込み済みの場合のみ）
 */
function lookupPostalCodeSync(postalCode: string): PostalEntry[] | null {
  if (!postalMap) return null;
  const normalized = normalizePostalCode(postalCode);
  if (!normalized || normalized.length !== 7) return [];
  return postalMap[normalized] || [];
}

/**
 * 郵便番号から住所候補を検索（非同期版）
 */
export async function lookupPostalCode(postalCode: string): Promise<PostalEntry[]> {
  const map = await loadPostalData();
  const normalized = normalizePostalCode(postalCode);
  if (!normalized || normalized.length !== 7) return [];
  return map[normalized] || [];
}

/**
 * 郵便番号と住所の照合（同期版 - 辞書未読み込みの場合はスキップ）
 * @param postalCode 郵便番号（正規化前）
 * @param prefecture パース済み都道府県
 * @param city パース済み市区町村
 * @param town パース済み町域
 * @returns 照合結果（フラグと候補リスト）
 */
export function verifyPostalCode(
  postalCode: string,
  prefecture: string,
  city: string,
  town: string
): PostalLookupResult {
  const flags: AddressFlag[] = [];

  // 郵便番号がない場合はチェックしない
  if (!postalCode || postalCode.trim() === '') {
    return { flags: [], candidates: [] };
  }

  // 形式チェック
  if (!isValidPostalFormat(postalCode)) {
    return { flags: ['POSTAL_INVALID_FORMAT'], candidates: [] };
  }

  // 辞書が読み込まれていない場合はスキップ
  const candidates = lookupPostalCodeSync(postalCode);
  if (candidates === null) {
    // 辞書未読み込み → フラグなしで返す（後で照合される）
    return { flags: [], candidates: [] };
  }

  // 候補なし
  if (candidates.length === 0) {
    return { flags: ['POSTAL_NOT_FOUND'], candidates: [] };
  }

  // 候補が複数
  if (candidates.length > 1) {
    // 住所とのマッチングを試みる（town も含めて照合）
    const matched = candidates.filter(
      (c) =>
        (!prefecture || c.prefecture === prefecture) &&
        (!city || c.city === city) &&
        (!town || c.town.startsWith(town) || town.startsWith(c.town))
    );

    if (matched.length === 0) {
      // どれともマッチしない → MISMATCH
      flags.push('POSTAL_MISMATCH');
    } else if (matched.length > 1) {
      // 複数マッチ → MULTI_TOWN（townが特定できない）
      flags.push('POSTAL_MULTI_TOWN');
    }
    // 1件マッチ → OK（自動補完はしない）

    return { flags, candidates };
  }

  // 候補が1件の場合
  const candidate = candidates[0];

  // 住所との照合
  const prefectureMatch = !prefecture || candidate.prefecture === prefecture;
  const cityMatch = !city || candidate.city === city;

  if (!prefectureMatch || !cityMatch) {
    flags.push('POSTAL_MISMATCH');
  }

  return { flags, candidates };
}

/**
 * 郵便番号と住所の照合（非同期版 - 辞書を必ず読み込む）
 */
export async function verifyPostalCodeAsync(
  postalCode: string,
  prefecture: string,
  city: string,
  town: string
): Promise<PostalLookupResult> {
  const flags: AddressFlag[] = [];

  // 郵便番号がない場合はチェックしない
  if (!postalCode || postalCode.trim() === '') {
    return { flags: [], candidates: [] };
  }

  // 形式チェック
  if (!isValidPostalFormat(postalCode)) {
    return { flags: ['POSTAL_INVALID_FORMAT'], candidates: [] };
  }

  // 辞書を読み込んで候補検索
  const candidates = await lookupPostalCode(postalCode);

  // 候補なし
  if (candidates.length === 0) {
    return { flags: ['POSTAL_NOT_FOUND'], candidates: [] };
  }

  // 候補が複数
  if (candidates.length > 1) {
    const matched = candidates.filter(
      (c) =>
        (!prefecture || c.prefecture === prefecture) &&
        (!city || c.city === city) &&
        (!town || c.town.startsWith(town) || town.startsWith(c.town))
    );

    if (matched.length === 0) {
      flags.push('POSTAL_MISMATCH');
    } else if (matched.length > 1) {
      flags.push('POSTAL_MULTI_TOWN');
    }

    return { flags, candidates };
  }

  // 候補が1件の場合
  const candidate = candidates[0];
  const prefectureMatch = !prefecture || candidate.prefecture === prefecture;
  const cityMatch = !city || candidate.city === city;

  if (!prefectureMatch || !cityMatch) {
    flags.push('POSTAL_MISMATCH');
  }

  return { flags, candidates };
}

/**
 * 郵便番号辞書を事前に読み込む
 */
export async function preloadPostalData(): Promise<void> {
  await loadPostalData();
}

/**
 * 郵便番号辞書が読み込み済みかどうか
 */
export function isPostalDataLoaded(): boolean {
  return postalMap !== null;
}
