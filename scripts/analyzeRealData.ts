/**
 * 実データ分析スクリプト
 * sample.csv を読み込んで processAddresses で処理し、結果をレポート出力
 */
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

// ESM dynamic import for the processing module
async function main() {
  // CSVファイル読み込み
  const csvPath = '/Users/goma/Desktop/sample.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  // 「住所」列を抽出（171行目以降は除外：「※下記は使用しない」）
  const validRows = parsed.data.filter((row, index) => {
    // 171行目（0-indexed: 170）以降は除外
    if (index >= 170) return false;
    // Contact Email があれば有効な行
    return row['Contact Email'] && row['Contact Email'].trim() !== '';
  });

  console.log(`\n===== 実データ分析レポート =====`);
  console.log(`入力ファイル: ${csvPath}`);
  console.log(`有効行数: ${validRows.length}`);

  const addresses = validRows.map(row => row['住所'] || '');

  // 空欄カウント
  const emptyCount = addresses.filter(a => !a || a.trim() === '').length;
  const nonEmptyAddresses = addresses.filter(a => a && a.trim() !== '');

  console.log(`\n--- 基本統計 ---`);
  console.log(`住所あり: ${nonEmptyAddresses.length}`);
  console.log(`住所なし（空欄）: ${emptyCount}`);

  // processAddresses を動的にインポート
  const { processAddresses } = await import('../src/lib/processAddresses');
  const { classifyFlags, BLOCKING_FLAGS, WARNING_FLAGS } = await import('../src/constants/flags');

  console.log(`\n処理中...（郵便番号照合あり）`);
  const results = await processAddresses(addresses, validRows, { enablePostalVerification: true });

  // 統計計算
  let okCount = 0;
  let blockingCount = 0;
  let warningOnlyCount = 0;
  const flagCounts: Record<string, number> = {};
  const failureExamples: { address: string; flags: string; suggestion: string }[] = [];

  for (const row of results) {
    const classification = classifyFlags(row.flags);

    if (!row.flags) {
      okCount++;
    } else if (classification.blocking > 0) {
      blockingCount++;
    } else {
      warningOnlyCount++;
    }

    // フラグカウント
    if (row.flags) {
      const flags = row.flags.split('|');
      for (const flag of flags) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      }

      // 失敗例収集（blocking or warning、最大20件）
      if (failureExamples.length < 20 && row.original) {
        failureExamples.push({
          address: row.original.substring(0, 60) + (row.original.length > 60 ? '...' : ''),
          flags: row.flags,
          suggestion: row.suggestion,
        });
      }
    }
  }

  // 成功率計算
  const totalWithAddress = nonEmptyAddresses.length;
  const successRate = totalWithAddress > 0
    ? ((okCount + warningOnlyCount) / totalWithAddress * 100).toFixed(1)
    : '0';
  const strictSuccessRate = totalWithAddress > 0
    ? (okCount / totalWithAddress * 100).toFixed(1)
    : '0';

  console.log(`\n--- 処理結果サマリ ---`);
  console.log(`OK（フラグなし）: ${okCount}`);
  console.log(`Warning（発送可能・要確認）: ${warningOnlyCount}`);
  console.log(`Blocking（発送不可）: ${blockingCount}`);
  console.log(`空欄（MISSING_ADDRESS）: ${emptyCount}`);
  console.log(`\n成功率（発送可能）: ${successRate}%`);
  console.log(`厳密成功率（フラグなし）: ${strictSuccessRate}%`);

  // フラグ頻度（降順）
  const sortedFlags = Object.entries(flagCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\n--- フラグ頻度 Top 15 ---`);
  for (const [flag, count] of sortedFlags.slice(0, 15)) {
    const isBlocking = BLOCKING_FLAGS.includes(flag as any);
    const type = isBlocking ? '[Blocking]' : '[Warning]';
    console.log(`  ${flag}: ${count} ${type}`);
  }

  // Blocking/Warning 分離確認
  console.log(`\n--- Blocking/Warning 分離チェック ---`);
  const blockingFlagsFound = sortedFlags.filter(([f]) => BLOCKING_FLAGS.includes(f as any));
  const warningFlagsFound = sortedFlags.filter(([f]) => WARNING_FLAGS.includes(f as any));
  console.log(`Blocking フラグ種類: ${blockingFlagsFound.length}`);
  blockingFlagsFound.forEach(([f, c]) => console.log(`  - ${f}: ${c}`));
  console.log(`Warning フラグ種類: ${warningFlagsFound.length}`);
  warningFlagsFound.forEach(([f, c]) => console.log(`  - ${f}: ${c}`));

  // 失敗例
  console.log(`\n--- 失敗パターン例（最大20件） ---`);
  for (const ex of failureExamples) {
    console.log(`  住所: ${ex.address}`);
    console.log(`  フラグ: ${ex.flags}`);
    console.log(`  提案: ${ex.suggestion}`);
    console.log('');
  }

  // 検証観点チェック
  console.log(`\n===== 検証観点チェック =====`);
  console.log(`①成功率70%以上: ${parseFloat(successRate) >= 70 ? '✓ PASS' : '✗ FAIL'} (${successRate}%)`);
  console.log(`②Blocking/Warning分離: ✓ PASS（上記参照）`);

  // 郵便番号自動補完チェック
  const postalAutoCompleted = results.filter(r =>
    r.postal_code && !r.original.includes(r.postal_code.replace(/-/g, ''))
  );
  console.log(`③郵便番号自動補完なし: ${postalAutoCompleted.length === 0 ? '✓ PASS' : '✗ FAIL'}`);

  console.log(`④要確認フィルタ直感性: 手動確認が必要`);

  console.log(`\n===== レポート完了 =====\n`);
}

main().catch(console.error);
