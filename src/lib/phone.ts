/**
 * 電話番号フラグ
 */
export type PhoneFlag =
  | 'AUTO_ZERO_RESTORED_MOBILE'  // 携帯の0落ちを自動補正
  | 'NEED_REVIEW_PHONE';          // 要確認（11桁以外）

/**
 * 正規化された電話番号
 */
export interface NormalizedPhone {
  raw: string;        // 元の文字列
  digits: string;     // 数字だけ（補正後）
  formatted: string;  // 出力用（000-0000-0000形式）
  flags: PhoneFlag[];
}

/**
 * 電話番号を正規化する
 * - 10桁で7/8/9始まり → 携帯の0落ちと判断し先頭に0を追加
 * - 11桁 → 000-0000-0000形式に整形
 * - それ以外 → NEED_REVIEW_PHONEフラグを付与
 *
 * @param raw 元の電話番号文字列
 * @returns 正規化結果
 */
export function normalizePhone(raw: string | undefined | null): NormalizedPhone {
  const flags: PhoneFlag[] = [];

  // 空の場合
  if (!raw) {
    return { raw: '', digits: '', formatted: '', flags };
  }

  const rawStr = String(raw);

  // 数字のみ抽出
  const onlyDigits = rawStr.replace(/\D/g, '');

  // 数字がない場合
  if (!onlyDigits) {
    return { raw: rawStr, digits: '', formatted: '', flags };
  }

  let digits = onlyDigits;

  // ① 携帯の0落ち救済: 10桁 & 7/8/9始まり → 頭に"0"をつける
  if (digits.length === 10 && ['7', '8', '9'].includes(digits[0])) {
    digits = '0' + digits;
    flags.push('AUTO_ZERO_RESTORED_MOBILE');
  }

  // ② 出力用フォーマット
  let formatted = digits;

  if (digits.length === 11) {
    // 携帯想定 000-0000-0000
    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;

    // 050（IP電話）は要確認フラグを付与
    if (digits.startsWith('050')) {
      flags.push('NEED_REVIEW_PHONE');
    }
  } else {
    // 11桁以外はそのまま + 要確認フラグ
    flags.push('NEED_REVIEW_PHONE');
  }

  return { raw: rawStr, digits, formatted, flags };
}
