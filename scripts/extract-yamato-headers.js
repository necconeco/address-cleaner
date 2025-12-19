/**
 * ヤマトB2テンプレートからヘッダー行を抽出するスクリプト
 *
 * 使い方: node scripts/extract-yamato-headers.js
 *
 * 出力先: src/lib/exporters/yamato/headers.json
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'newb2web_template1.xls');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'exporters', 'yamato', 'headers.json');

function extractHeaders() {
  console.log('Reading template:', TEMPLATE_PATH);

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('Template file not found:', TEMPLATE_PATH);
    process.exit(1);
  }

  const workbook = XLSX.readFile(TEMPLATE_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // 範囲を取得
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // 1行目をヘッダーとして読み取り（最初の行のみ取得）
  const headers = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddress];
    let value = cell ? String(cell.v || '').trim() : '';

    // 改行で分割して最初の行だけ取得（説明文を除外）
    const firstLine = value.split('\n')[0].trim();
    headers.push(firstLine);
  }

  console.log(`Extracted ${headers.length} columns`);
  console.log('First 10 columns:', headers.slice(0, 10));
  console.log('Last 5 columns:', headers.slice(-5));

  // JSON出力
  const output = {
    totalColumns: headers.length,
    headers: headers,
    extractedAt: new Date().toISOString(),
    sourceFile: path.basename(TEMPLATE_PATH),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log('Written to:', OUTPUT_PATH);
}

extractHeaders();
