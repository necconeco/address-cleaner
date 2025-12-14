// Building語尾辞書
export const BUILDING_SUFFIXES = [
  'ビル',
  'マンション',
  'ハイツ',
  'レジデンス',
  'コーポ',
  '荘',
  'アパート',
  'タワー',
  'プラザ',
  'パレス',
  'メゾン',
  'ハウス',
  'コート',
  'ガーデン',
  'テラス',
  'ヴィラ',
  'シャトー',
  'グランド',
  'スクエア',
  'ホームズ',
  'シティ',
  'パーク',
  '棟',
];

// Building語尾の正規表現パターン
export const BUILDING_SUFFIX_PATTERN = new RegExp(
  `(${BUILDING_SUFFIXES.join('|')})`,
  'i'
);
