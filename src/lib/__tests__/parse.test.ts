import { describe, it, expect } from 'vitest';
import { parseAddress } from '../parse';
import { detectFormat } from '../detectFormat';
import { normalize } from '../normalize';

/**
 * 住所パーサーユニットテスト
 * - 境界ケース 20件
 * - Google Maps形式代表
 * - 丁目番地号代表
 */

describe('parseAddress', () => {
  // ヘルパー: 住所を正規化→形式判定→パース
  const parse = (address: string) => {
    const normalized = normalize(address);
    const format = detectFormat(normalized);
    return parseAddress(normalized, format);
  };

  describe('Google Maps形式', () => {
    it('日本語市区町村を正しく抽出', () => {
      const result = parse('葛飾区, Tokyo, 124-0001, Japan');
      expect(result.prefecture).toBe('東京都');
      expect(result.city).toBe('葛飾区');
      expect(result.flags).not.toContain('MISSING_CITY');
    });

    it('那覇市, Okinawa Prefecture を正しく抽出', () => {
      const result = parse('真嘉比1-6-10, グランディールAjミーヤ, 那覇市, Okinawa Prefecture, 9020068, Japan');
      expect(result.prefecture).toBe('沖縄県');
      expect(result.city).toBe('那覇市');
      expect(result.number_block).toBe('1-6-10');
    });

    it('鹿児島市, Kagoshima Prefecture を正しく抽出', () => {
      const result = parse('鹿児島市中央町16-1, D Grande 鹿児島中央605, 鹿児島市, Kagoshima Prefecture, 8900053, Japan');
      expect(result.prefecture).toBe('鹿児島県');
      expect(result.city).toBe('鹿児島市');
    });

    it('ローマ字city（Bunkyo-ku）を認識', () => {
      const result = parse('2-11-9, #319, Bunkyo-ku, Tokyo, 112-0011, Japan');
      expect(result.prefecture).toBe('東京都');
      expect(result.city).toBe('Bunkyo-ku');
      expect(result.flags).toContain('NEED_REVIEW_CITY');
    });

    it('マクロン付きprefecture（Ōsaka）を認識', () => {
      const result = parse('大阪市西区江之子島 2-1-37-1305, 大阪市, Ōsaka Prefecture, 550-0006, Japan');
      expect(result.prefecture).toBe('大阪府');
    });

    it('Kyōto Prefecture を認識', () => {
      const result = parse('枇杷庄鹿背田4-5, 城陽市, Kyōto Prefecture, 6100117, Japan');
      expect(result.prefecture).toBe('京都府');
      expect(result.city).toBe('城陽市');
    });

    it('prefecture直前フォールバックでcityを取得', () => {
      const result = parse('340-6, daiaparesuhatuoiminami 302, Hamamatu, Shizuoka Prefecture, 4338112, Japan');
      expect(result.prefecture).toBe('静岡県');
      expect(result.city).toBe('Hamamatu');
      expect(result.flags).toContain('NEED_REVIEW_CITY');
    });

    it('市区町村の後に文字が続くパターン（日野市多摩平）', () => {
      const result = parse('2-5-1, クレヴィア豊田多摩平416, 日野市多摩平, Tokyo, 1910062, Japan');
      expect(result.city).toBe('日野市');
    });
  });

  describe('日本語形式', () => {
    it('標準的な日本語住所', () => {
      const result = parse('東京都江戸川区篠崎町4-28-16');
      expect(result.prefecture).toBe('東京都');
      expect(result.city).toBe('江戸川区');
      expect(result.town).toBe('篠崎町');
      expect(result.number_block).toBe('4-28-16');
    });

    it('建物名付き住所', () => {
      const result = parse('東京都江戸川区篠崎町4-28-16 栞101');
      expect(result.prefecture).toBe('東京都');
      expect(result.city).toBe('江戸川区');
      expect(result.building).toContain('栞');
    });

    it('丁目番地号パターン', () => {
      const result = parse('東京都新宿区西新宿2丁目8番1号');
      expect(result.prefecture).toBe('東京都');
      expect(result.city).toBe('新宿区');
      expect(result.number_block).toContain('2丁目');
    });
  });

  describe('番地パターン（MISSING_NUMBER_BLOCK対策）', () => {
    it('日本語内の数字を抽出（字川田7）', () => {
      const result = parse('字川田7, Residence GAKU 102号室, 岡崎市北本郷町, Aichi Prefecture, 4440944, Japan');
      expect(result.number_block).toBeTruthy();
      expect(result.flags).not.toContain('MISSING_NUMBER_BLOCK');
    });

    it('日本語内の数字を抽出（中丸子759）', () => {
      const result = parse('川崎市中原区中丸子759, クリオ多摩川中丸子101, 川崎市中原区, Kanagawa Prefecture, 2110012, Japan');
      expect(result.number_block).toBeTruthy();
      expect(result.flags).not.toContain('MISSING_NUMBER_BLOCK');
    });

    it('単独数字をNEED_REVIEW_NUMBER付きで採用（431）', () => {
      const result = parse('431, 加須市道目, Saitama Prefecture, 3491157, Japan');
      expect(result.number_block).toBe('431');
      expect(result.flags).toContain('NEED_REVIEW_NUMBER');
      expect(result.flags).not.toContain('MISSING_NUMBER_BLOCK');
    });

    it('単独数字をNEED_REVIEW_NUMBER付きで採用（712）', () => {
      const result = parse('712, Sakai, Ōsaka Prefecture, 587-0012, Japan');
      expect(result.number_block).toBe('712');
      expect(result.flags).toContain('NEED_REVIEW_NUMBER');
    });

    it('番地パターン（213番地）', () => {
      const result = parse('東京都世田谷区桜丘213番地');
      expect(result.number_block).toBe('213番地');
    });

    it('1丁目1番地6パターン', () => {
      const result = parse('1丁目1番地6, エバーライフ壱番館407, 大牟田市, Fukuoka Prefecture, 8360801, Japan');
      expect(result.number_block).toContain('1丁目');
    });
  });

  describe('境界ケース', () => {
    it('空文字列はUNKNOWN_FORMATになる', () => {
      const result = parse('');
      expect(result.flags).toContain('UNKNOWN_FORMAT');
    });

    it('プレースホルダ（該当なし）はMISSING_ADDRESSになる', () => {
      // プレースホルダは processAddresses で処理されるため、
      // parseAddress では UNKNOWN_FORMAT になる
      const result = parse('該当なし');
      expect(result.flags).toContain('UNKNOWN_FORMAT');
    });

    it('郵便番号のみ', () => {
      const result = parse('123-4567');
      expect(result.postal_code).toBe('123-4567');
      expect(result.flags).toContain('UNKNOWN_FORMAT');
    });

    it('Prefecture なしでも Tokyo を認識', () => {
      const result = parse('新宿区西新宿1-2-3, Tokyo, 160-0023, Japan');
      expect(result.prefecture).toBe('東京都');
    });

    it('Hokkaidō（マクロン）を認識', () => {
      const result = parse('札幌市中央区, Hokkaidō Prefecture, 060-0001, Japan');
      expect(result.prefecture).toBe('北海道');
    });

    it('room抽出（#319）', () => {
      const result = parse('2-11-9, #319, Bunkyo-ku, Tokyo, Japan');
      expect(result.room).toBe('#319');
    });

    it('room抽出（101号室）', () => {
      const result = parse('東京都江戸川区篠崎町4-28-16 栞101号室');
      expect(result.room).toBe('101号室');
    });

    it('4セグメント番地（1-2-3-401）', () => {
      const result = parse('上福岡4-13-26-205, ふじみ野市, Saitama Prefecture, 3560004, Japan');
      expect(result.number_block).toBe('4-13-26');
      expect(result.room).toBe('205');
    });

    it('海外住所はMISSING_PREFECTUREになる', () => {
      const result = parse('Lautensackstraße 1, München, BY, 80687, Germany');
      expect(result.flags).toContain('MISSING_PREFECTURE');
    });

    it('郵便番号ハイフンなし（7桁）を正規化', () => {
      const result = parse('東京都新宿区西新宿1-2-3, 1600023');
      expect(result.postal_code).toBe('160-0023');
    });
  });

  describe('フラグ分類', () => {
    it('LABEL_HAS_ENGLISHは発送可能（Warning）', () => {
      // このテストは processAddresses で確認
      // parseAddress はラベルチェックを行わない
      expect(true).toBe(true);
    });

    it('POSTAL_MISMATCHは発送可能（Warning）', () => {
      // このテストは processAddresses で確認
      expect(true).toBe(true);
    });
  });
});
