/**
 * ゆうパックプリントR CSV列定義
 */

// =====================================================
// 列番号定義（1始まり）
// =====================================================

export const YupackColumn = {
  SLIP_TYPE: 1,               // 送り状種別
  COD_TYPE: 2,                // 着払い区分
  // 3-6: 予備
  HONORIFIC_TYPE: 7,          // お届け先敬称種別
  DEST_NAME: 8,               // お届け先名
  DEST_HONORIFIC: 9,          // お届け先敬称
  DEST_NAME_KANA: 10,         // お届け先カナ
  DEST_POSTAL: 11,            // お届け先郵便番号
  DEST_ADDRESS1: 12,          // お届け先住所1（都道府県）
  DEST_ADDRESS2: 13,          // お届け先住所2（市区町村〜番地）
  DEST_ADDRESS3: 14,          // お届け先住所3（番地詳細）
  DEST_ADDRESS4: 15,          // お届け先住所4（建物名）
  DEST_PHONE: 16,             // お届け先電話番号
  DEST_COMPANY: 17,           // お届け先会社名
  DEST_DEPARTMENT: 18,        // お届け先部署名
  DEST_EMAIL: 19,             // お届け先メールアドレス
  // 20-22: 予備
  SENDER_NAME: 23,            // ご依頼主名
  SENDER_HONORIFIC: 24,       // ご依頼主敬称
  SENDER_NAME_KANA: 25,       // ご依頼主カナ
  SENDER_POSTAL: 26,          // ご依頼主郵便番号
  SENDER_ADDRESS1: 27,        // ご依頼主住所1
  SENDER_ADDRESS2: 28,        // ご依頼主住所2
  SENDER_ADDRESS3: 29,        // ご依頼主住所3
  SENDER_ADDRESS4: 30,        // ご依頼主住所4
  SENDER_PHONE: 31,           // ご依頼主電話番号
  SENDER_COMPANY: 32,         // ご依頼主会社名
  SENDER_DEPARTMENT: 33,      // ご依頼主部署名
  SENDER_EMAIL: 34,           // ご依頼主メールアドレス
  PRODUCT_NAME: 35,           // 品名
  WEIGHT: 36,                 // 重量
  SIZE: 37,                   // サイズ
  // 38-72: その他設定
  TOTAL_COLUMNS: 72,          // 総列数
} as const;

// =====================================================
// 送り状種別
// =====================================================

export const YupackSlipType = {
  YUPACK: '1',                // ゆうパック
  YUPACKET: '2',              // ゆうパケット
} as const;

// =====================================================
// 着払い区分
// =====================================================

export const YupackCodType = {
  PREPAID: '0',               // 元払い
  COD: '1',                   // 着払い
} as const;

// =====================================================
// 敬称種別
// =====================================================

export const YupackHonorificType = {
  SAMA: '1',                  // 様
  ONCHU: '2',                 // 御中
  DONO: '3',                  // 殿
} as const;

// =====================================================
// 0埋めが必要な列（サンプルCSVに基づく）
// =====================================================

export const YupackZeroColumns = [
  39, 40, 43, 44, 45, 46, 47, 48, 49, 51,
  64, 65, 68, 69, 70, 71, 72
] as const;
