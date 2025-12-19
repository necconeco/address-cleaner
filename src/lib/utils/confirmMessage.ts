/**
 * 顧客確認依頼文生成ユーティリティ
 */
import { OutputRow } from '@/types';

/**
 * 確認依頼文テンプレートを生成
 */
export function generateConfirmationMessage(row: OutputRow, customerName?: string): string {
  const parsedAddress = [
    row.prefecture,
    row.city,
    row.town,
    row.number_block,
    row.building,
    row.room,
  ].filter(Boolean).join(' ');

  const name = customerName || 'お客様';
  const reason = row.customerConfirmReason || '住所情報に確認が必要な点があります';

  return `${name}様

ご注文いただきありがとうございます。

お届け先住所について確認させていただきたい点がございます。

【ご登録住所】
${row.original || '（登録なし）'}

【解析結果】
${parsedAddress}

【確認理由】
${reason}

お手数ですが、正しい住所をご返信いただけますと幸いです。

よろしくお願いいたします。`;
}

/**
 * mailtoリンクを生成
 */
export function generateMailtoLink(
  row: OutputRow,
  emailColumn: string | undefined,
  nameColumn: string | undefined
): string | null {
  if (!emailColumn || !row._originalColumns?.[emailColumn]) return null;

  const email = row._originalColumns[emailColumn];
  const customerName = nameColumn && row._originalColumns?.[nameColumn]
    ? row._originalColumns[nameColumn]
    : undefined;
  const message = generateConfirmationMessage(row, customerName);
  const subject = encodeURIComponent('【ご確認】お届け先住所について');
  const body = encodeURIComponent(message);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
