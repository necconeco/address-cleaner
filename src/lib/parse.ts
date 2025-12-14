import { FormatType, AddressFlag } from '@/types';
import { PREFECTURE_EN_TO_JA } from '@/constants/prefectureMap';
import { BUILDING_SUFFIXES } from '@/constants/buildingSuffixes';
import { extractPostalCode } from './normalize';

interface ParseResult {
  prefecture: string;
  city: string;
  town: string;
  number_block: string;
  building: string;
  room: string;
  postal_code: string;
  flags: AddressFlag[];
}

/**
 * 住所をパースする
 */
export function parseAddress(
  normalized: string,
  formatType: FormatType
): ParseResult {
  switch (formatType) {
    case 'google_maps':
      return parseGoogleMaps(normalized);
    case 'japanese_full':
      return parseJapaneseFull(normalized);
    default:
      return parseUnknown(normalized);
  }
}

/**
 * Google Maps形式をパース（後ろから剥がす）
 * 改善版: 日本語の市区町村も認識
 */
function parseGoogleMaps(address: string): ParseResult {
  const flags: AddressFlag[] = [];
  let remaining = address;

  // 1. Japan を削除
  remaining = remaining.replace(/,?\s*Japan\s*$/i, '').trim();

  // 2. 郵便番号を抽出
  const postal_code = extractPostalCode(remaining) || '';
  if (postal_code) {
    remaining = remaining.replace(postal_code, '').replace(/,\s*,/g, ',').trim();
  }

  // 3. カンマで分割（trim + 空要素除去）
  const parts = remaining
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // 4. Prefecture を後ろから探す
  let prefecture = '';
  let prefectureIndex = -1;
  let cityCandidate = ''; // prefecture直前のトークン（フォールバック用）

  // 4a. "XXX Prefecture" パターン
  for (let i = parts.length - 1; i >= 0; i--) {
    const prefMatch = parts[i].match(/^(.+?)\s*Prefecture$/i);
    if (prefMatch) {
      const prefEn = prefMatch[1].trim();
      // マクロン除去（ō→o, ū→u等）
      const prefEnNormalized = prefEn.replace(/[ōŌ]/g, 'o').replace(/[ūŪ]/g, 'u');
      prefecture = PREFECTURE_EN_TO_JA[prefEn] || PREFECTURE_EN_TO_JA[prefEnNormalized] || '';
      prefectureIndex = i;
      // 直前のトークンをcity候補として保存
      if (i > 0 && !/^\d+(-\d+)*$/.test(parts[i - 1])) {
        cityCandidate = parts[i - 1];
      }
      if (!prefecture) {
        // マッピングにない場合はフラグを立てるが、元の値を保持
        prefecture = prefMatch[0];
        flags.push('NEED_REVIEW_PREFECTURE');
      }
      break;
    }
  }

  // 4b. 単独の都道府県名（Tokyo, Osaka等）
  if (!prefecture) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      for (const [en, ja] of Object.entries(PREFECTURE_EN_TO_JA)) {
        if (part.toLowerCase() === en.toLowerCase()) {
          prefecture = ja;
          prefectureIndex = i;
          // 直前のトークンをcity候補として保存
          if (i > 0 && !/^\d+(-\d+)*$/.test(parts[i - 1])) {
            cityCandidate = parts[i - 1];
          }
          break;
        }
      }
      if (prefecture) break;
    }
  }

  // 4c. 日本語の都道府県（トークン内に含まれる場合）
  if (!prefecture) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      const jpPrefMatch = part.match(/(.{2,3}[都道府県])$/);
      if (jpPrefMatch) {
        prefecture = jpPrefMatch[1];
        prefectureIndex = i;
        // トークンから都道府県を除去して残りを保持
        const remainder = part.slice(0, -prefecture.length).trim();
        if (remainder) {
          parts[i] = remainder;
        } else {
          parts.splice(i, 1);
          prefectureIndex = -1; // 既に削除済み
        }
        break;
      }
    }
  }

  // prefectureIndexの要素を削除
  if (prefectureIndex >= 0) {
    parts.splice(prefectureIndex, 1);
  }

  if (!prefecture) {
    flags.push('MISSING_PREFECTURE');
  }

  // 5. city を後ろから探す
  let city = '';
  let cityIndex = -1;
  let cityNeedsReview = false;

  // 5a. 日本語の市区町村（優先）
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // 日本語の市区町村パターン
    // パターン1: 末尾が市/区/町/村（例: 葛飾区、那覇市）
    // パターン2: 市区町村の後に文字が続く（例: 日野市多摩平、市川市真間）
    if (/[^\x00-\x7F]/.test(part)) {
      // 非ASCII文字が含まれていれば日本語
      // まず末尾パターンを試す
      const jpCityMatch = part.match(/(.*[市区町村])$/);
      if (jpCityMatch) {
        city = jpCityMatch[1];
        cityIndex = i;
        break;
      }
      // 市区町村の後に文字が続くパターン（例: 日野市多摩平 → 日野市）
      const jpCityMidMatch = part.match(/^(.+?[市区町村])/);
      if (jpCityMidMatch) {
        city = jpCityMidMatch[1];
        // 残りの部分をpartsに戻す
        const remainder = part.slice(city.length).trim();
        if (remainder) {
          parts[i] = remainder;
        } else {
          cityIndex = i;
        }
        break;
      }
    }
  }

  // 5b. ローマ字の市区町村
  if (!city) {
    // パターン1: -ku, -shi 等のサフィックス
    const cityPatterns = [/-ku$/i, /-shi$/i, /-cho$/i, /-son$/i, /-machi$/i, /-mura$/i];
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (cityPatterns.some((p) => p.test(part))) {
        city = part;
        cityIndex = i;
        cityNeedsReview = true;
        break;
      }
    }

    // パターン2: 都道府県の直前のトークンをcity候補とする（フォールバック）
    // 例: "340-6, daiaparesuhatuoiminami 302, Hamamatu, Shizuoka Prefecture"
    //     → Hamamatu が city 候補
    if (!city && cityCandidate && prefecture) {
      // partsから該当要素を探して削除
      const idx = parts.findIndex(p => p === cityCandidate);
      if (idx >= 0) {
        city = cityCandidate;
        cityIndex = idx;
        cityNeedsReview = true;
      }
    }
  }

  // cityIndexの要素を削除
  if (cityIndex >= 0) {
    parts.splice(cityIndex, 1);
  }

  if (!city) {
    flags.push('MISSING_CITY');
  } else if (cityNeedsReview) {
    flags.push('NEED_REVIEW_CITY');
  }

  // 6. 残りからroom/number_block/buildingを抽出
  const remainingStr = parts.join(' ');
  const { room, number_block, building, roomBuildingFlags } =
    extractRoomNumberBuilding(remainingStr);

  flags.push(...roomBuildingFlags);

  if (!number_block) {
    flags.push('MISSING_NUMBER_BLOCK');
  }

  return {
    prefecture,
    city,
    town: '',
    number_block,
    building,
    room,
    postal_code,
    flags,
  };
}

/**
 * 日本語形式をパース（前から切る）
 */
function parseJapaneseFull(address: string): ParseResult {
  const flags: AddressFlag[] = [];
  let remaining = address;

  // 1. 郵便番号を抽出
  const postal_code = extractPostalCode(remaining) || '';
  if (postal_code) {
    remaining = remaining.replace(/〒?\s*/, '').replace(postal_code, '').trim();
  }

  // 2. 都道府県を抽出
  let prefecture = '';
  const prefMatch = remaining.match(/^(.{2}[都道府県]|.{3}県)/);
  if (prefMatch) {
    prefecture = prefMatch[1];
    remaining = remaining.slice(prefecture.length).trim();
  } else {
    flags.push('MISSING_PREFECTURE');
  }

  // 3. 市区町村を抽出（B方式）
  let city = '';
  const cityMatch = remaining.match(/^(.+?[市区町村])/);
  if (cityMatch) {
    city = cityMatch[1];
    remaining = remaining.slice(city.length).trim();
  } else {
    flags.push('MISSING_CITY');
  }

  // 4. 町域を試行（任意）
  let town = '';
  // 町域は複雑なので、number_blockの前までを取る簡易実装
  const townMatch = remaining.match(/^([^\d]+?)(?=\d)/);
  if (townMatch) {
    town = townMatch[1].trim();
    remaining = remaining.slice(town.length).trim();
  }

  // 5. room/number_block/buildingを抽出
  const { room, number_block, building, roomBuildingFlags } =
    extractRoomNumberBuilding(remaining);

  flags.push(...roomBuildingFlags);

  if (!number_block) {
    flags.push('MISSING_NUMBER_BLOCK');
  }

  return {
    prefecture,
    city,
    town,
    number_block,
    building,
    room,
    postal_code,
    flags,
  };
}

/**
 * unknown形式をパース（最小限の抽出）
 */
function parseUnknown(address: string): ParseResult {
  const flags: AddressFlag[] = ['UNKNOWN_FORMAT'];

  // 郵便番号のみ抽出
  const postal_code = extractPostalCode(address) || '';

  // number_blockのみ試行
  const numberMatch = address.match(/\d+(-\d+){1,3}/);
  const number_block = numberMatch ? numberMatch[0] : '';

  if (!number_block) {
    flags.push('MISSING_NUMBER_BLOCK');
  }

  return {
    prefecture: '',
    city: '',
    town: '',
    number_block,
    building: '',
    room: '',
    postal_code,
    flags,
  };
}

/**
 * room/number_block/buildingを抽出
 * 処理順: room抽出→number_block→building
 */
function extractRoomNumberBuilding(text: string): {
  room: string;
  number_block: string;
  building: string;
  roomBuildingFlags: AddressFlag[];
} {
  const flags: AddressFlag[] = [];
  let remaining = text;
  let room = '';
  let number_block = '';
  let building = '';

  // 1. room候補を先に抽出
  // パターン: #319, 3F, 3階, B1, 101号室, Room 5, Unit 12
  const roomPatterns = [
    /(\d+F)\b/i,
    /(\d+階)/,
    /(B\d+)\b/i,
    /(\d+号室)/,
    /(#\d+)/,
    /(Room\s*\d+)/i,
    /(Unit\s*\d+)/i,
  ];

  for (const pattern of roomPatterns) {
    const match = remaining.match(pattern);
    if (match) {
      room = match[1];
      remaining = remaining.replace(match[0], ' ').trim();
      break;
    }
  }

  // 2. number_blockを判定
  // 4セグメント: 1-2-3-401 → number_block=1-2-3, room=401
  const fourSegMatch = remaining.match(/(\d+)-(\d+)-(\d+)-(\d{3,4})\b/);
  if (fourSegMatch) {
    number_block = `${fourSegMatch[1]}-${fourSegMatch[2]}-${fourSegMatch[3]}`;
    if (!room) {
      room = fourSegMatch[4];
      flags.push('NEED_REVIEW_NUMBER');
    }
    remaining = remaining.replace(fourSegMatch[0], ' ').trim();
  } else {
    // 2-3セグメント: 1-2-3 or 1-2
    const numberMatch = remaining.match(/\d+(-\d+){1,2}/);
    if (numberMatch) {
      number_block = numberMatch[0];
      remaining = remaining.replace(numberMatch[0], ' ').trim();
    }
  }

  // 丁目番地号パターン（柔軟版）
  if (!number_block) {
    // パターン1: 2丁目4番8号、1丁目1番地6 等
    const chomeBanGoMatch = remaining.match(/(\d+丁目\d*番地?\d*号?)/);
    if (chomeBanGoMatch) {
      number_block = chomeBanGoMatch[1];
      remaining = remaining.replace(chomeBanGoMatch[0], ' ').trim();
    }
  }

  if (!number_block) {
    // パターン2: 番地のみ（213番地 等）
    const banchiMatch = remaining.match(/(\d+番地\d*)/);
    if (banchiMatch) {
      number_block = banchiMatch[1];
      remaining = remaining.replace(banchiMatch[0], ' ').trim();
    }
  }

  // 日本語文字列内の数字を抽出（字川田7 → 7、中丸子759 → 759）
  if (!number_block) {
    // 日本語の後に続く数字
    const jpNumberMatch = remaining.match(/[^\d\s](\d+)(?:\s|$)/);
    if (jpNumberMatch) {
      number_block = jpNumberMatch[1];
      flags.push('NEED_REVIEW_NUMBER');
      remaining = remaining.replace(jpNumberMatch[1], ' ').trim();
    }
  }

  // 単独数字をnumber_blockとして採用（NEED_REVIEW_NUMBER付き）
  if (!number_block) {
    const standaloneNum = remaining.match(/(?:^|\s)(\d{1,5})(?:\s|$)/);
    if (standaloneNum) {
      // 郵便番号っぽい7桁は除外
      if (standaloneNum[1].length !== 7) {
        number_block = standaloneNum[1];
        flags.push('NEED_REVIEW_NUMBER');
        remaining = remaining.replace(standaloneNum[1], ' ').trim();
      }
    }
  }

  // 3. building候補を判定
  // building語尾辞書にマッチするか
  const buildingSuffixPattern = new RegExp(
    `(.+?(?:${BUILDING_SUFFIXES.join('|')})[^\\s]*)`,
    'i'
  );
  const buildingMatch = remaining.match(buildingSuffixPattern);

  if (buildingMatch) {
    let buildingCandidate = buildingMatch[1].trim();

    // building候補 + 末尾2-4桁数字 → roomに分離
    const trailingNumberMatch = buildingCandidate.match(/^(.+?)(\d{2,4})$/);
    if (trailingNumberMatch && !room) {
      buildingCandidate = trailingNumberMatch[1].trim();
      room = trailingNumberMatch[2];
    }

    building = buildingCandidate;
    remaining = remaining.replace(buildingMatch[0], ' ').trim();
  }

  // 4. 残りに固有名詞っぽい文字列 + 末尾数字がある場合
  if (!building && remaining) {
    const fixedNameMatch = remaining.match(/^([^\d]+?)(\d{2,4})$/);
    if (fixedNameMatch) {
      building = fixedNameMatch[1].trim();
      if (!room) {
        room = fixedNameMatch[2];
      }
      remaining = '';
    }
  }

  // 5. 建物名なしで末尾数字のみの場合
  if (!room && !building && remaining) {
    const standaloneNumber = remaining.match(/^\s*(\d{2,4})\s*$/);
    if (standaloneNumber) {
      room = standaloneNumber[1];
      flags.push('NEED_REVIEW_ROOM_BUILDING');
      remaining = '';
    }
  }

  // 単独数字のみの場合
  const singleNumber = remaining.match(/^\s*(\d+)\s*$/);
  if (singleNumber && !room && !number_block) {
    flags.push('NEED_REVIEW_NUMBER');
  }

  return { room, number_block, building, roomBuildingFlags: flags };
}
