import { FormatType } from '@/types';

/**
 * 住所の形式を判定する
 */
export function detectFormat(address: string): FormatType {
  // Google Maps形式の判定
  if (isGoogleMapsFormat(address)) {
    return 'google_maps';
  }

  // 日本語形式の判定
  if (isJapaneseFullFormat(address)) {
    return 'japanese_full';
  }

  return 'unknown';
}

/**
 * Google Maps形式かどうか判定
 */
function isGoogleMapsFormat(address: string): boolean {
  // Japan を含む
  if (/Japan/i.test(address)) {
    return true;
  }

  // Prefecture を含む
  if (/Prefecture/i.test(address)) {
    return true;
  }

  // カンマが3つ以上
  const commaCount = (address.match(/,/g) || []).length;
  if (commaCount >= 3) {
    return true;
  }

  return false;
}

/**
 * 日本語形式かどうか判定
 */
function isJapaneseFullFormat(address: string): boolean {
  // 都道府県を含む
  return /[都道府県]/.test(address);
}
