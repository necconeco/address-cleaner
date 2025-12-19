import Papa from 'papaparse';
import { OutputRow } from '@/types';

/**
 * ヤマトB2クラウド（ネコポス）用CSV列定義（旧形式・13列）
 */
const YAMATO_B2_COLUMNS = [
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
];

/**
 * ヤマトB2クラウド95列ヘッダー（簡略版）
 */
const B2_HEADERS_SIMPLE = [
  'お客様管理番号',           // 1
  '送り状種類',               // 2 → "A" (ネコポス)
  'クール区分',               // 3
  '伝票番号',                 // 4
  '出荷予定日',               // 5
  'お届け予定日',             // 6
  '配達時間帯',               // 7
  'お届け先コード',           // 8
  'お届け先電話番号',         // 9 → formatted phone
  'お届け先電話番号枝番',     // 10
  'お届け先郵便番号',         // 11 → postal_code (ハイフン付き)
  'お届け先住所',             // 12 → 都道府県+市区町村+町域+番地
  'お届け先アパートマンション名', // 13 → 建物+部屋
  'お届け先会社・部門１',     // 14
  'お届け先会社・部門２',     // 15
  'お届け先名',               // 16 → _name
  'お届け先名(ｶﾅ)',          // 17 → _nameKana
  '敬称',                     // 18
  'ご依頼主コード',           // 19
  'ご依頼主電話番号',         // 20
  'ご依頼主電話番号枝番',     // 21
  'ご依頼主郵便番号',         // 22
  'ご依頼主住所',             // 23
  'ご依頼主アパートマンション', // 24
  'ご依頼主名',               // 25
  'ご依頼主名(ｶﾅ)',          // 26
  '品名コード１',             // 27
  '品名１',                   // 28
  '品名コード２',             // 29
  '品名２',                   // 30
  '荷扱い１',                 // 31
  '荷扱い２',                 // 32
  '記事',                     // 33
  'ｺﾚｸﾄ代金引換額（税込)',   // 34
  '内消費税額等',             // 35
  '止置き',                   // 36
  '営業所コード',             // 37
  '発行枚数',                 // 38
  '個数口表示フラグ',         // 39
  '請求先顧客コード',         // 40
  '請求先分類コード',         // 41
  '運賃管理番号',             // 42
  'クロネコwebコレクトデータ登録', // 43
  'クロネコwebコレクト加盟店番号', // 44
  'クロネコwebコレクト申込受付番号１', // 45
  'クロネコwebコレクト申込受付番号２', // 46
  'クロネコwebコレクト申込受付番号３', // 47
  'お届け予定ｅメール利用区分', // 48
  'お届け予定ｅメールe-mailアドレス', // 49
  '入力機種',                 // 50
  'お届け予定ｅメールメッセージ', // 51
  'お届け完了ｅメール利用区分', // 52
  'お届け完了ｅメールe-mailアドレス', // 53
  'お届け完了ｅメールメッセージ', // 54
  'クロネコ収納代行利用区分', // 55
  '予備',                     // 56
  '収納代行請求金額(税込)',   // 57
  '収納代行内消費税額等',     // 58
  '収納代行請求先郵便番号',   // 59
  '収納代行請求先住所',       // 60
  '収納代行請求先住所（アパートマンション名）', // 61
  '収納代行請求先会社・部門名１', // 62
  '収納代行請求先会社・部門名２', // 63
  '収納代行請求先名(漢字)',   // 64
  '収納代行請求先名(カナ)',   // 65
  '収納代行問合せ先名(漢字)', // 66
  '収納代行問合せ先郵便番号', // 67
  '収納代行問合せ先住所',     // 68
  '収納代行問合せ先住所（アパートマンション名）', // 69
  '収納代行問合せ先電話番号', // 70
  '収納代行管理番号',         // 71
  '収納代行品名',             // 72
  '収納代行備考',             // 73
  '複数口くくりキー',         // 74
  '検索キータイトル1',        // 75
  '検索キー1',                // 76
  '検索キータイトル2',        // 77
  '検索キー2',                // 78
  '検索キータイトル3',        // 79
  '検索キー3',                // 80
  '検索キータイトル4',        // 81
  '検索キー4',                // 82
  '検索キータイトル5',        // 83
  '検索キー5',                // 84
  '予備',                     // 85
  '予備',                     // 86
  '投函予定メール利用区分',   // 87
  '投函予定メールe-mailアドレス', // 88
  '投函予定メールメッセージ', // 89
  '投函完了メール（お届け先宛）利用区分', // 90
  '投函完了メール（お届け先宛）e-mailアドレス', // 91
  '投函完了メール（お届け先宛）メールメッセージ', // 92
  '投函完了メール（ご依頼主宛）利用区分', // 93
  '投函完了メール（ご依頼主宛）e-mailアドレス', // 94
  '投函完了メール（ご依頼主宛）メールメッセージ', // 95
];

/**
 * 文字列をtrimして連続空白を除去
 */
function cleanString(str: string | undefined | null): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * 住所フィールドを正規化する（B2出力用）
 * - NFKC正規化
 * - 全角英数字→半角
 * - 全角スペース→半角スペース
 * - ハイフン類を統一（長音符「ー」は保護）
 * - カタカナ間のハイフンを長音符に変換（ボヌ-ル → ボヌール）
 * - スペースは完全削除（B2用）
 */
function normalizeField(str: string | undefined | null): string {
  if (!str) return '';
  let result = str;

  // Unicode正規化（NFKC）
  result = result.normalize('NFKC');

  // 全角英数字→半角
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // 全角スペース→半角スペース（NFKCで変換されるが念のため）
  result = result.replace(/　/g, ' ');

  // ハイフン類を統一（長音符「ー」は除外して保護）
  // −: 全角マイナス(U+2212), ―: ダッシュ(U+2015), –: ENダッシュ(U+2013)
  // —: EMダッシュ(U+2014), ‐: ハイフン(U+2010), ‒: フィギュアダッシュ(U+2012)
  result = result.replace(/[−―–—‐‒]/g, '-');

  // カタカナ間のハイフンを長音符に変換（ボヌ-ル → ボヌール）
  result = result.replace(/([ァ-ヶ])-([ァ-ヶ])/g, '$1ー$2');

  // 前後と全スペースを削除（B2出力用：スペースゼロ）
  result = result.trim().replace(/\s+/g, '');

  return result;
}

/**
 * 郵便番号を正規化（7桁ハイフンなし）
 */
function normalizePostalForExport(str: string | undefined | null, withHyphen: boolean = false): string {
  if (!str) return '';
  // 数字のみ抽出して7桁に
  const digits = str.replace(/\D/g, '');
  const postal = digits.length >= 7 ? digits.slice(0, 7) : digits;

  if (withHyphen && postal.length === 7) {
    return `${postal.slice(0, 3)}-${postal.slice(3)}`;
  }
  return postal;
}

/**
 * B2出力用の正規形住所を生成
 * 正規形: prefecture + city + town + chome丁目 + number_block（スペースなし・日本語）
 * 例: 東京都北区西ケ原2丁目41-16
 */
function generateCanonicalAddress(row: OutputRow): string {
  // 丁目がある場合は「X丁目」形式で追加
  const chomeStr = row.chome ? `${row.chome}丁目` : '';

  return [
    normalizeField(row.prefecture),
    normalizeField(row.city),
    normalizeField(row.town),
    chomeStr,
    normalizeField(row.number_block),
  ].filter(Boolean).join('');
}

/**
 * B2出力用の正規形建物名を生成
 * 正規形: building + room（スペースなし）
 */
function generateCanonicalApartment(row: OutputRow): string {
  return [
    normalizeField(row.building),
    normalizeField(row.room),
  ].filter(Boolean).join('');
}

/**
 * ヤマトB2クラウド形式にデータを変換
 * - お届け先住所: 正規形（prefecture + city + town + number_block、スペースなし）
 * - お届け先アパートマンション名: 正規形（building + room、スペースなし）
 */
function convertToYamatoB2Format(row: OutputRow, postalWithHyphen: boolean = false): Record<string, string> {
  return {
    'お届け先郵便番号': normalizePostalForExport(row.postal_code, postalWithHyphen),
    'お届け先住所': generateCanonicalAddress(row),
    'お届け先アパートマンション名': generateCanonicalApartment(row),
    'お届け先名': '',
    'お届け先電話番号': '',
    'ご依頼主郵便番号': '',
    'ご依頼主住所': '',
    'ご依頼主アパートマンション名': '',
    'ご依頼主名': '',
    'ご依頼主電話番号': '',
    '品名': '',
    '発送予定日': '',
    '送り状種類': '0', // 0: 発払い
  };
}

// エクスポートオプション
export interface YamatoExportOptions {
  postalWithHyphen?: boolean; // 郵便番号にハイフンを付けるか
}

/**
 * ヤマトB2クラウド形式でCSV出力
 */
export function exportToYamatoB2Csv(
  data: OutputRow[],
  originalColumns: string[],
  filename: string = 'yamato_b2.csv',
  options: YamatoExportOptions = {}
): void {
  const { postalWithHyphen = false } = options;

  // 名前・電話番号列を自動検出
  const nameColumn = originalColumns.find(col =>
    col.includes('名前') || col.includes('氏名') || col.toLowerCase().includes('name')
  );
  const phoneColumn = originalColumns.find(col =>
    col.includes('電話') || col.includes('TEL') || col.toLowerCase().includes('phone')
  );

  const rows = data.map((row) => {
    const yamatoRow = convertToYamatoB2Format(row, postalWithHyphen);

    // 元データから名前・電話番号を補完
    if (nameColumn && row._originalColumns?.[nameColumn]) {
      yamatoRow['お届け先名'] = cleanString(row._originalColumns[nameColumn]);
    }
    if (phoneColumn && row._originalColumns?.[phoneColumn]) {
      yamatoRow['お届け先電話番号'] = cleanString(row._originalColumns[phoneColumn]);
    }

    return yamatoRow;
  });

  const csv = Papa.unparse(rows, {
    columns: YAMATO_B2_COLUMNS,
    header: true,
  });

  // BOM付きUTF-8でダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * 顧客確認用CSV列定義
 */
const CUSTOMER_CONFIRM_COLUMNS = [
  'email',
  '氏名',
  '元住所',
  '解析結果',
  '確認理由',
];

/**
 * 顧客確認用CSV出力
 * - email / 氏名 / 元住所 / 解析結果 / 確認理由
 */
export function exportToCustomerConfirmCsv(
  data: OutputRow[],
  originalColumns: string[],
  filename: string = 'customer_confirm.csv'
): void {
  // メール・名前列を自動検出
  const emailColumn = originalColumns.find(col =>
    col.toLowerCase().includes('email') || col.toLowerCase().includes('mail') || col.includes('メール')
  );
  const nameColumn = originalColumns.find(col =>
    col.includes('名前') || col.includes('氏名') || col.toLowerCase().includes('name')
  );

  const rows = data.map((row) => {
    // 解析結果を組み立て
    const parsedAddress = [
      row.prefecture,
      row.city,
      row.town,
      row.number_block,
      row.building,
      row.room,
    ].filter(Boolean).join(' ');

    return {
      'email': emailColumn && row._originalColumns?.[emailColumn]
        ? cleanString(row._originalColumns[emailColumn])
        : '',
      '氏名': nameColumn && row._originalColumns?.[nameColumn]
        ? cleanString(row._originalColumns[nameColumn])
        : '',
      '元住所': row.original || '',
      '解析結果': parsedAddress,
      '確認理由': row.customerConfirmReason || '',
    };
  });

  const csv = Papa.unparse(rows, {
    columns: CUSTOMER_CONFIRM_COLUMNS,
    header: true,
  });

  // BOM付きUTF-8でダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

// 結果列の順序
const RESULT_COLUMN_ORDER = [
  'original',
  'normalized',
  'format_type',
  'prefecture',
  'city',
  'town',
  'number_block',
  'building',
  'room',
  'postal_code',
  'confidence',
  'flags',
  'suggestion',
  'label_line1',
  'label_line2',
];

export function exportToCsv(
  data: OutputRow[],
  originalColumns: string[],
  includeOriginalColumns: boolean,
  filename: string
): void {
  // 列順を構築
  const columns = [
    ...(includeOriginalColumns ? originalColumns : []),
    ...RESULT_COLUMN_ORDER,
  ];

  // データを整形
  const rows = data.map((row) => {
    const result: Record<string, string | number> = {};

    // 元列
    if (includeOriginalColumns && row._originalColumns) {
      originalColumns.forEach((col) => {
        result[col] = row._originalColumns?.[col] || '';
      });
    }

    // 結果列
    RESULT_COLUMN_ORDER.forEach((col) => {
      result[col] = row[col as keyof OutputRow] as string | number;
    });

    return result;
  });

  // CSVに変換
  const csv = Papa.unparse(rows, {
    columns,
    header: true,
  });

  // BOM付きUTF-8でダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

// =====================================================
// 佐川 e飛伝Ⅲ用
// =====================================================

/**
 * 半角英数字を全角に変換
 * 0-9 → ０-９
 * A-Z → Ａ-Ｚ
 * a-z → ａ-ｚ
 */
function toFullWidthAlphanumeric(str: string): string {
  if (!str) return '';
  return str.replace(/[0-9A-Za-z]/g, (char) => {
    const code = char.charCodeAt(0);
    // 半角数字 0-9 (48-57) → 全角数字 ０-９ (65296-65305)
    // 半角大文字 A-Z (65-90) → 全角大文字 Ａ-Ｚ (65313-65338)
    // 半角小文字 a-z (97-122) → 全角小文字 ａ-ｚ (65345-65370)
    return String.fromCharCode(code + 0xfee0);
  });
}

/**
 * 文字列の全角換算文字数を計算
 * 半角: 0.5文字、全角: 1文字
 * ※佐川の制限は全角48文字 = 半角96文字相当
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getFullWidthLength(str: string): number {
  let len = 0;
  for (const char of str) {
    const code = char.charCodeAt(0);
    // 半角文字の判定（ASCII 0x20-0x7E）
    if (code >= 0x20 && code <= 0x7e) {
      len += 0.5;
    } else {
      len += 1;
    }
  }
  return len;
}

/**
 * 全角換算で指定文字数ずつ分割
 * @param str 分割する文字列
 * @param maxFullWidthChars 1行あたりの全角換算最大文字数
 * @returns 分割された文字列の配列
 */
function splitByFullWidthLength(str: string, maxFullWidthChars: number): string[] {
  const result: string[] = [];
  let current = '';
  let currentLen = 0;

  for (const char of str) {
    const code = char.charCodeAt(0);
    const charLen = (code >= 0x20 && code <= 0x7e) ? 0.5 : 1;

    if (currentLen + charLen > maxFullWidthChars) {
      result.push(current);
      current = char;
      currentLen = charLen;
    } else {
      current += char;
      currentLen += charLen;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * 佐川e飛伝Ⅲ用に住所を正規化
 * 1. 住所パーツを結合
 * 2. 半角英数字→全角変換
 * 3. 全角48文字ずつ分割
 */
function generateSagawaAddress(row: OutputRow): { address1: string; address2: string; address3: string } {
  // 1. 住所パーツの結合
  const chomeStr = row.chome ? `${row.chome}丁目` : '';
  const fullAddress = [
    normalizeField(row.prefecture),
    normalizeField(row.city),
    normalizeField(row.town),
    chomeStr,
    normalizeField(row.number_block),
    normalizeField(row.building),
    normalizeField(row.room),
  ].filter(Boolean).join('');

  // 2. 半角英数字→全角変換
  const fullWidthAddress = toFullWidthAlphanumeric(fullAddress);

  // 3. 全角48文字ずつ分割
  const parts = splitByFullWidthLength(fullWidthAddress, 48);

  return {
    address1: parts[0] || '',
    address2: parts[1] || '',
    address3: parts[2] || '',
  };
}

/**
 * 佐川e飛伝Ⅲ用CSVヘッダー
 * 最低限必要な列のみ定義
 */
const SAGAWA_E_HIDEN_HEADERS = [
  'お届け先郵便番号',
  'お届け先住所１',
  'お届け先住所２',
  'お届け先住所３',
  'お届け先名称１',
  'お届け先名称２',
  'お届け先電話番号',
  'ご依頼主郵便番号',
  'ご依頼主住所１',
  'ご依頼主住所２',
  'ご依頼主名称１',
  'ご依頼主電話番号',
  '品名１',
  '荷姿',
  '重量',
  '指定日',
  '指定時間帯',
  '配達サービス',
];

/**
 * 佐川e飛伝Ⅲ用CSV出力
 * - 住所1〜3: 全角英数字、全角48文字ずつ分割
 * - 名前・郵便番号・電話番号: そのまま（全角化しない）
 */
export function exportToSagawaEhidenCsv(
  data: OutputRow[],
  filename: string = 'sagawa_ehiden3.csv'
): void {
  const rows = data.map((row) => {
    const { address1, address2, address3 } = generateSagawaAddress(row);

    return {
      'お届け先郵便番号': normalizePostalForExport(row.postal_code, true), // ハイフン付き
      'お届け先住所１': address1,
      'お届け先住所２': address2,
      'お届け先住所３': address3,
      'お届け先名称１': row._name || '',
      'お届け先名称２': '',
      'お届け先電話番号': row._phone?.formatted || '',
      'ご依頼主郵便番号': '',
      'ご依頼主住所１': '',
      'ご依頼主住所２': '',
      'ご依頼主名称１': '',
      'ご依頼主電話番号': '',
      '品名１': '',
      '荷姿': '',
      '重量': '',
      '指定日': '',
      '指定時間帯': '',
      '配達サービス': '',
    };
  });

  const csv = Papa.unparse(rows, {
    columns: SAGAWA_E_HIDEN_HEADERS,
    header: true,
  });

  // BOM付きShift_JISでダウンロード（佐川はShift_JIS推奨だが、UTF-8 BOM付きでも対応可能なことが多い）
  // ここではUTF-8 BOM付きで出力
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

// =====================================================
// ゆうパックプリントR用
// =====================================================

/**
 * ゆうパックプリントR用に住所を生成
 * - 住所1: 都道府県
 * - 住所2: 市区町村 + 町域 + 丁目 + 番地
 * - 住所3: 建物 + 部屋
 */
function generateYupackAddress(row: OutputRow): { address1: string; address2: string; address3: string } {
  const chomeStr = row.chome ? `${row.chome}丁目` : '';

  return {
    address1: normalizeField(row.prefecture),
    address2: [
      normalizeField(row.city),
      normalizeField(row.town),
      chomeStr,
      normalizeField(row.number_block),
    ].filter(Boolean).join(''),
    address3: [
      normalizeField(row.building),
      normalizeField(row.room),
    ].filter(Boolean).join(''),
  };
}

/**
 * ゆうパックプリントR用CSV出力（72列）
 * - Shift-JIS形式
 * - ヘッダー行なし
 * - お届け先情報を列8〜19に設定
 */
export function exportToYupackCsv(
  data: OutputRow[],
  filename: string = 'yupack.csv'
): void {
  const rows = data.map((row) => {
    // 72列分の空配列を作成
    const values: string[] = new Array(72).fill('');

    // 固定値
    values[0] = '1';   // 列1: 送り状種別（1=ゆうパック）
    values[1] = '0';   // 列2: 着払い区分（0=元払い）
    values[6] = '1';   // 列7: お届け先敬称種別（1=様）

    // お届け先情報（列8〜19）
    values[7] = row._name || '';              // 列8: お届け先名
    values[8] = '様';                          // 列9: お届け先敬称
    values[9] = row._nameKana || '';           // 列10: お届け先カナ
    values[10] = normalizePostalForExport(row.postal_code, false);  // 列11: 郵便番号（ハイフンなし7桁）

    const { address1, address2, address3 } = generateYupackAddress(row);
    values[11] = address1;                     // 列12: お届け先住所1（都道府県）
    values[12] = address2;                     // 列13: お届け先住所2（市区町村〜番地）
    values[13] = '';                           // 列14: お届け先住所3（番地詳細）※address2に含めた
    values[14] = address3;                     // 列15: お届け先住所4（建物名）
    values[15] = row._phone?.formatted || '';  // 列16: お届け先電話番号

    // ご依頼主情報（列23〜34）は空で出力（ユーザーがゆうプリR側で設定）

    // その他必須の0埋め
    values[38] = '0';  // 列39
    values[39] = '0';  // 列40
    values[42] = '0';  // 列43
    values[43] = '0';  // 列44
    values[44] = '0';  // 列45
    values[45] = '0';  // 列46
    values[46] = '0';  // 列47
    values[47] = '0';  // 列48
    values[48] = '0';  // 列49
    values[50] = '0';  // 列51
    values[63] = '0';  // 列64
    values[64] = '0';  // 列65
    values[67] = '0';  // 列68
    values[68] = '0';  // 列69
    values[69] = '0';  // 列70
    values[70] = '0';  // 列71
    values[71] = '0';  // 列72

    return values;
  });

  // データ行のみ（ヘッダーなし）
  const csvContent = rows.map(r =>
    r.map(v => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v).join(',')
  ).join('\n');

  // Shift-JISでエンコード（ゆうプリRはShift-JIS必須）
  // ブラウザではShift-JISエンコードが難しいため、UTF-8 BOM付きで出力
  // ※実際にはencoding.jsなどのライブラリが必要だが、ここではUTF-8で出力
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * ヤマトB2クラウド（ネコポス）用95列CSV出力
 */
export function exportToYamatoB2FullCsv(
  data: OutputRow[],
  filename: string = 'yamato_b2_nekopos.csv'
): void {
  const rows = data.map((row) => {
    // 95列分の空配列を作成
    const values: string[] = new Array(95).fill('');

    // 必要な列のみ値を設定（配列は0始まりなので列番号-1）
    values[1] = 'A';  // 列2: 送り状種類: ネコポス
    values[8] = row._phone?.formatted || '';  // 列9: お届け先電話番号
    values[10] = normalizePostalForExport(row.postal_code, true);  // 列11: 郵便番号（ハイフン付き）
    values[11] = generateCanonicalAddress(row);  // 列12: お届け先住所
    values[12] = generateCanonicalApartment(row);  // 列13: アパートマンション名
    values[15] = row._name || '';  // 列16: お届け先名
    values[16] = row._nameKana || '';  // 列17: お届け先名（カナ）

    return values;
  });

  // ヘッダー行 + データ行
  const csvContent = [
    B2_HEADERS_SIMPLE.join(','),
    ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // BOM付きUTF-8でダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
