/**
 * 行カテゴリ分類ユーティリティ
 */
import { OutputRow, AddressFlag } from '@/types';
import { BLOCKING_FLAGS, WARNING_FLAGS, CUSTOMER_CONFIRM_FLAGS } from '@/constants/flags';

export type RowCategory = 'empty' | 'needs_fix' | 'ok' | 'customer_confirm';

/**
 * 行のカテゴリを判定
 */
export function categorizeRow(row: OutputRow): RowCategory {
  const flagList = row.flags ? row.flags.split('|').filter(Boolean) as AddressFlag[] : [];

  // 顧客確認フラグがあるかチェック（最優先）
  const hasCustomerConfirm = flagList.some(f => CUSTOMER_CONFIRM_FLAGS.includes(f));
  if (hasCustomerConfirm) {
    return 'customer_confirm';
  }

  // 未入力: 都道府県と市区町村の両方がない（主要な住所情報がない状態）
  const isEmpty = !row.prefecture && !row.city;
  if (isEmpty) {
    return 'empty';
  }

  // blocking/warningフラグがあるかチェック
  const hasBlockingOrWarning = flagList.some(
    f => BLOCKING_FLAGS.includes(f) || WARNING_FLAGS.includes(f)
  );
  if (hasBlockingOrWarning) {
    return 'needs_fix';
  }

  return 'ok';
}

/**
 * カテゴリ別のカウントを計算
 */
export function getCategoryCounts(results: OutputRow[]): Record<RowCategory, number> {
  const counts: Record<RowCategory, number> = { empty: 0, needs_fix: 0, ok: 0, customer_confirm: 0 };
  results.forEach(row => {
    const category = categorizeRow(row);
    counts[category]++;
  });
  return counts;
}
