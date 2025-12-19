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
 * 住所文字列を正規化（比較用）
 * - NFKC正規化
 * - 全角英数字→半角
 * - 空白類（全角/半角/タブ/改行）を完全除去
 * - ハイフン類の統一
 * - 不可視文字の除去
 */
export function normalizeAddressForComparison(str: string | undefined | null): string {
  if (!str) return '';
  let result = str;

  // Unicode正規化（NFKC）
  result = result.normalize('NFKC');

  // 全角英数字→半角
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // ハイフン類を統一（−: U+2212, ―: U+2015, –: U+2013, —: U+2014, ‐: U+2010, ‒: U+2012, ー: 長音符は除外）
  result = result.replace(/[−―–—‐‒\-]/g, '-');

  // 不可視文字の除去（ゼロ幅スペース、BOM、ソフトハイフン等）
  result = result.replace(/[\u200B-\u200D\uFEFF\u00AD\u00A0]/g, '');

  // 全ての空白類を完全除去（全角/半角スペース/タブ/改行/その他Unicode空白）
  result = result.replace(/[\s\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, '');

  return result;
}

/**
 * 町域比較用の正規化（より緩い比較）
 * - 基本正規化を行った後、
 * - 丁目・番地表記を統一
 */
function normalizeTownForComparison(str: string | undefined | null): string {
  if (!str) return '';
  let result = normalizeAddressForComparison(str);

  // 「丁目」「番地」「番」などの数字表記を統一
  // 例: 「一丁目」→「1丁目」、「二番地」→「2番地」
  const kanjiNumbers: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
  };
  result = result.replace(/([一二三四五六七八九十]+)(丁目|番地|番|号)/g, (_, num, suffix) => {
    const converted = num.split('').map((c: string) => kanjiNumbers[c] || c).join('');
    return converted + suffix;
  });

  return result;
}

// 曖昧な町域パターン（照合から除外）
const AMBIGUOUS_TOWN_PATTERNS = [
  '以下に掲載がない場合',
  'の次に番地がくる場合',
  '以下に掲載がない',
  '掲載がない場合',
  '（その他）',
  'その他',
];

/**
 * 町域が曖昧かどうかをチェック
 */
function isAmbiguousTown(town: string): boolean {
  if (!town) return false;
  return AMBIGUOUS_TOWN_PATTERNS.some(pattern => town.includes(pattern));
}

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
  // デバッグ用: 比較に使用したキー
  debugInfo?: {
    postalKey: string;  // 郵便番号から引いた住所キー（pref+city+town）
    inputKey: string;   // 入力された住所キー（pref+city+town）
    matchDetails?: {
      prefMatch: boolean;
      cityMatch: boolean;
      townMatch: boolean;
    };
  };
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
 * 町域の一致判定（正規化済みの値で比較）
 * - 片方が空なら一致扱い
 * - 曖昧な町域（「以下に掲載がない場合」等）は一致扱い
 * - 前方一致で比較（「立部」と「立部1-129-4」は一致）
 */
function matchTown(postalTown: string, inputTown: string): boolean {
  // 片方が空なら一致扱い
  if (!postalTown || !inputTown) return true;

  // 曖昧な町域は一致扱い
  if (isAmbiguousTown(postalTown)) return true;

  // 正規化して比較
  const normalizedPostal = normalizeTownForComparison(postalTown);
  const normalizedInput = normalizeTownForComparison(inputTown);

  // 完全一致
  if (normalizedPostal === normalizedInput) return true;

  // 前方一致（郵便番号APIの町域は番地を含まないので、入力側が長いケースが多い）
  // 例: postal=「立部」, input=「立部1-129-4」→ 一致
  if (normalizedInput.startsWith(normalizedPostal)) return true;

  // 逆方向の前方一致（入力側が短いケース）
  // 例: postal=「立部一丁目」, input=「立部」→ 一致
  if (normalizedPostal.startsWith(normalizedInput)) return true;

  return false;
}

/**
 * 郵便番号と住所の照合（同期版 - 辞書未読み込みの場合はスキップ）
 * @param postalCode 郵便番号（正規化前）
 * @param prefecture パース済み都道府県
 * @param city パース済み市区町村
 * @param town パース済み町域（番地を含んでいても可）
 * @returns 照合結果（フラグと候補リスト）
 *
 * 比較ルール:
 * - pref + city + town のみ比較（番地・建物・部屋は除外）
 * - NFKC / 全角半角 / ハイフン統一で正規化してから比較
 * - 町域は前方一致（郵便番号APIは町域までしか返さないため）
 * - 町域が曖昧（「以下に掲載がない場合」等）な場合は NEED_REVIEW_TOWN
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

  // 入力値を正規化
  const normPref = normalizeAddressForComparison(prefecture);
  const normCity = normalizeAddressForComparison(city);
  const normTown = normalizeAddressForComparison(town);
  const inputKey = `${normPref}${normCity}${normTown}`;

  // 候補が複数の場合: 都道府県+市区町村までの照合でOKとする
  if (candidates.length > 1) {
    // デバッグ用キーを生成（最初の候補で）
    const firstCand = candidates[0];
    const postalKey = `${normalizeAddressForComparison(firstCand.prefecture)}${normalizeAddressForComparison(firstCand.city)}${normalizeAddressForComparison(firstCand.town)}`;

    // 都道府県+市区町村が候補のどれかと一致しているかチェック
    const prefCityMatched = candidates.some((c) => {
      const candPref = normalizeAddressForComparison(c.prefecture);
      const candCity = normalizeAddressForComparison(c.city);

      const prefMatch = !normPref || candPref === normPref;
      const cityMatch = !normCity || candCity === normCity;

      return prefMatch && cityMatch;
    });

    if (!prefCityMatched) {
      // 都道府県・市区町村がどれとも合わない → MISMATCH
      flags.push('POSTAL_MISMATCH');
    } else {
      // 都道府県・市区町村は一致 → POSTAL_AMBIGUOUS（INFO扱い）
      // 町域はエラー条件にしない
      flags.push('POSTAL_AMBIGUOUS');
    }

    return {
      flags,
      candidates,
      debugInfo: {
        postalKey,
        inputKey,
      },
    };
  }

  // 候補が1件の場合
  const candidate = candidates[0];
  const candPref = normalizeAddressForComparison(candidate.prefecture);
  const candCity = normalizeAddressForComparison(candidate.city);
  const candTown = normalizeAddressForComparison(candidate.town);
  const postalKey = `${candPref}${candCity}${candTown}`;

  // デバッグ用: 個別一致チェック（表示用のみ）
  const prefMatch = !normPref || candPref === normPref;
  const cityMatch = !normCity || candCity === normCity;
  const townMatch = matchTown(candidate.town, town);

  // === 最終判定: keyが一致したら「一致扱い」===
  // postalKey と inputKey を比較（空白除去済み）
  // ただし入力側がpostalKeyを含む（前方一致）場合も一致扱い
  const keyMatched = postalKey === inputKey ||
    inputKey.startsWith(postalKey) ||
    postalKey.startsWith(inputKey);

  // 曖昧な町域の場合はNEED_REVIEW_TOWN
  if (isAmbiguousTown(candidate.town) && town) {
    flags.push('NEED_REVIEW_TOWN');
  } else if (!keyMatched) {
    // key不一致の場合のみMISMATCH
    flags.push('POSTAL_MISMATCH');
  }

  return {
    flags,
    candidates,
    debugInfo: {
      postalKey,
      inputKey,
      matchDetails: {
        prefMatch,
        cityMatch,
        townMatch,
      },
    },
  };
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

  // 入力値を正規化
  const normPref = normalizeAddressForComparison(prefecture);
  const normCity = normalizeAddressForComparison(city);
  const normTown = normalizeAddressForComparison(town);
  const inputKey = `${normPref}${normCity}${normTown}`;

  // 候補が複数の場合: 都道府県+市区町村までの照合でOKとする
  if (candidates.length > 1) {
    const firstCand = candidates[0];
    const postalKey = `${normalizeAddressForComparison(firstCand.prefecture)}${normalizeAddressForComparison(firstCand.city)}${normalizeAddressForComparison(firstCand.town)}`;

    // 都道府県+市区町村が候補のどれかと一致しているかチェック
    const prefCityMatched = candidates.some((c) => {
      const candPref = normalizeAddressForComparison(c.prefecture);
      const candCity = normalizeAddressForComparison(c.city);

      const prefMatch = !normPref || candPref === normPref;
      const cityMatch = !normCity || candCity === normCity;

      return prefMatch && cityMatch;
    });

    if (!prefCityMatched) {
      // 都道府県・市区町村がどれとも合わない → MISMATCH
      flags.push('POSTAL_MISMATCH');
    } else {
      // 都道府県・市区町村は一致 → POSTAL_AMBIGUOUS（INFO扱い）
      flags.push('POSTAL_AMBIGUOUS');
    }

    return {
      flags,
      candidates,
      debugInfo: {
        postalKey,
        inputKey,
      },
    };
  }

  // 候補が1件の場合
  const candidate = candidates[0];
  const candPref = normalizeAddressForComparison(candidate.prefecture);
  const candCity = normalizeAddressForComparison(candidate.city);
  const candTown = normalizeAddressForComparison(candidate.town);
  const postalKey = `${candPref}${candCity}${candTown}`;

  // デバッグ用: 個別一致チェック（表示用のみ）
  const prefMatch = !normPref || candPref === normPref;
  const cityMatch = !normCity || candCity === normCity;
  const townMatch = matchTown(candidate.town, town);

  // === 最終判定: keyが一致したら「一致扱い」===
  const keyMatched = postalKey === inputKey ||
    inputKey.startsWith(postalKey) ||
    postalKey.startsWith(inputKey);

  if (isAmbiguousTown(candidate.town) && town) {
    flags.push('NEED_REVIEW_TOWN');
  } else if (!keyMatched) {
    flags.push('POSTAL_MISMATCH');
  }

  return {
    flags,
    candidates,
    debugInfo: {
      postalKey,
      inputKey,
      matchDetails: {
        prefMatch,
        cityMatch,
        townMatch,
      },
    },
  };
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

export interface PostalCompletionResult {
  prefecture: string;
  city: string;
  town: string;
  needsReviewTown: boolean;  // 町域が曖昧で要確認
  multiTown: boolean;        // 複数町域がある
  completed: boolean;        // 補完が行われたか
}

/**
 * 郵便番号から住所を補完する
 * - 都道府県・市区町村は1つに確定できる場合のみ補完
 * - 町域が曖昧（複数候補、「以下に掲載がない場合」等）な場合はneedsReviewTown=true
 */
export async function completeAddressFromPostal(
  postalCode: string
): Promise<PostalCompletionResult | null> {
  // 形式チェック
  if (!isValidPostalFormat(postalCode)) {
    return null;
  }

  const candidates = await lookupPostalCode(postalCode);

  // 候補なし
  if (candidates.length === 0) {
    return null;
  }

  // 都道府県・市区町村の一意性チェック
  const prefectures = Array.from(new Set(candidates.map(c => c.prefecture)));
  const cities = Array.from(new Set(candidates.map(c => c.city)));

  // 都道府県が複数ある場合は補完不可
  if (prefectures.length > 1) {
    return null;
  }

  // 市区町村が複数ある場合は補完不可
  if (cities.length > 1) {
    return null;
  }

  const prefecture = prefectures[0];
  const city = cities[0];

  // 町域の処理
  let town = '';
  let needsReviewTown = false;
  let multiTown = false;

  if (candidates.length === 1) {
    const candidateTown = candidates[0].town;

    // 曖昧な町域パターンかチェック
    if (isAmbiguousTown(candidateTown)) {
      town = '';  // 町域は補完しない
      needsReviewTown = true;
    } else {
      town = candidateTown;
    }
  } else {
    // 複数町域がある場合
    multiTown = true;
    needsReviewTown = true;
    // 共通部分があれば使う（例: 「○○一丁目」「○○二丁目」→ 補完しない）
    town = '';
  }

  return {
    prefecture,
    city,
    town,
    needsReviewTown,
    multiTown,
    completed: true,
  };
}
