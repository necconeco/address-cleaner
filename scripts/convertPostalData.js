/**
 * 日本郵便KEN_ALL.CSVをJSON辞書に変換
 * 郵便番号 → [{prefecture, city, town}] のマッピング
 */
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const inputPath = path.join(__dirname, 'KEN_ALL.CSV');
const outputPath = path.join(__dirname, '..', 'src', 'data', 'postalCode.json');

// CSVを読み込み（Shift_JIS）
const buffer = fs.readFileSync(inputPath);
const content = iconv.decode(buffer, 'Shift_JIS');

const lines = content.split('\n').filter(line => line.trim());

const postalMap = {};

lines.forEach(line => {
  // CSV解析（シンプルなパース）
  const match = line.match(/^(\d+),"([^"]+)","(\d{7})","[^"]*","[^"]*","[^"]*","([^"]+)","([^"]+)","([^"]+)"/);
  if (!match) return;

  const [, , , postalCode, prefecture, city, town] = match;

  // 「以下に掲載がない場合」は除外
  if (town === '以下に掲載がない場合') return;

  // 特殊な町域名を除外（括弧内の詳細など）
  let cleanTown = town;
  // 括弧内の説明を除去
  cleanTown = cleanTown.replace(/（.*）/g, '');
  // 「〜を除く」などを除去
  cleanTown = cleanTown.replace(/を除く$/, '');
  // 「〜の次に番地がくる場合」を除去
  cleanTown = cleanTown.replace(/の次に番地がくる場合$/, '');

  if (!postalMap[postalCode]) {
    postalMap[postalCode] = [];
  }

  // 重複チェック
  const exists = postalMap[postalCode].some(
    entry => entry.prefecture === prefecture && entry.city === city && entry.town === cleanTown
  );

  if (!exists) {
    postalMap[postalCode].push({
      prefecture,
      city,
      town: cleanTown
    });
  }
});

// 出力ディレクトリ作成
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// JSON出力
fs.writeFileSync(outputPath, JSON.stringify(postalMap, null, 0));

console.log(`変換完了: ${Object.keys(postalMap).length}件の郵便番号`);
console.log(`出力先: ${outputPath}`);
