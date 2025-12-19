/**
 * ヤマトB2クラウド CSV列定義
 */
import headersData from './headers.json';

// =====================================================
// ネコポス95列 列番号定義（1始まり）
// =====================================================

export const YamatoNekoposColumn = {
  CUSTOMER_CODE: 1,           // お客様管理番号
  SLIP_TYPE: 2,               // 送り状種類 → "A" (ネコポス)
  COOL_TYPE: 3,               // クール区分
  SLIP_NUMBER: 4,             // 伝票番号
  SHIP_DATE: 5,               // 出荷予定日
  DELIVERY_DATE: 6,           // お届け予定日
  DELIVERY_TIME: 7,           // 配達時間帯
  DEST_CODE: 8,               // お届け先コード
  DEST_PHONE: 9,              // お届け先電話番号
  DEST_PHONE_EXT: 10,         // お届け先電話番号枝番
  DEST_POSTAL: 11,            // お届け先郵便番号
  DEST_ADDRESS: 12,           // お届け先住所
  DEST_APARTMENT: 13,         // お届け先アパートマンション名
  DEST_COMPANY1: 14,          // お届け先会社・部門１
  DEST_COMPANY2: 15,          // お届け先会社・部門２
  DEST_NAME: 16,              // お届け先名
  DEST_NAME_KANA: 17,         // お届け先名(ｶﾅ)
  HONORIFIC: 18,              // 敬称
  SENDER_CODE: 19,            // ご依頼主コード
  SENDER_PHONE: 20,           // ご依頼主電話番号
  SENDER_PHONE_EXT: 21,       // ご依頼主電話番号枝番
  SENDER_POSTAL: 22,          // ご依頼主郵便番号
  SENDER_ADDRESS: 23,         // ご依頼主住所
  SENDER_APARTMENT: 24,       // ご依頼主アパートマンション
  SENDER_NAME: 25,            // ご依頼主名
  SENDER_NAME_KANA: 26,       // ご依頼主名(ｶﾅ)
  PRODUCT_CODE1: 27,          // 品名コード１
  PRODUCT_NAME1: 28,          // 品名１
  PRODUCT_CODE2: 29,          // 品名コード２
  PRODUCT_NAME2: 30,          // 品名２
  HANDLING1: 31,              // 荷扱い１
  HANDLING2: 32,              // 荷扱い２
  NOTE: 33,                   // 記事
  COD_AMOUNT: 34,             // ｺﾚｸﾄ代金引換額（税込)
  COD_TAX: 35,                // 内消費税額等
  HOLD: 36,                   // 止置き
  OFFICE_CODE: 37,            // 営業所コード
  PRINT_COUNT: 38,            // 発行枚数
  PACKAGE_FLAG: 39,           // 個数口表示フラグ
  BILLING_CUSTOMER: 40,       // 請求先顧客コード
  BILLING_CLASS: 41,          // 請求先分類コード
  FREIGHT_NUMBER: 42,         // 運賃管理番号
  // 43-95: Webコレクト、メール通知、収納代行など
  TOTAL_COLUMNS: 95,          // 総列数
} as const;

// =====================================================
// 送り状種類
// =====================================================

export const YamatoSlipType = {
  NEKOPOS: 'A',               // ネコポス
  TAKKYUBIN: '0',             // 宅急便（発払い）
  TAKKYUBIN_COLLECT: '2',     // 宅急便（着払い）
  TAKKYUBIN_COMPACT: '3',     // 宅急便コンパクト
} as const;

// =====================================================
// 簡易版13列 列定義
// =====================================================

export const YamatoSimpleColumns = [
  'お届け先郵便番号',
  'お届け先住所',
  'お届け先アパートマンション名',
  'お届け先名',
  'お届け先電話番号',
  'ご依頼主郵便番号',
  'ご依頼主住所',
  'ご依頼主アパートマンション名',
  'ご依頼主名',
  'ご依頼主電話番号',
  '品名',
  '発送予定日',
  '送り状種類',
] as const;

// =====================================================
// 95列ヘッダー（テンプレートから読み込み）
// =====================================================

/**
 * ヘッダー行（newb2web_template1.xlsから抽出）
 * 再生成: node scripts/extract-yamato-headers.js
 */
export const YamatoNekoposHeaders: readonly string[] = headersData.headers;
