'use client';

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FLAG_LABELS } from '@/constants/flags';
import { AddressFlag } from '@/types';

export function HelpAccordion() {
  return (
    <>
      {/* フォーマット説明 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">フォーマット説明</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>形式</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>判定条件</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>例</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>google_maps</TableCell>
                  <TableCell>
                    Japan を含む、Prefecture を含む、カンマ区切りが多い
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>
                    2-11-9, #319, Bunkyo-ku, Tokyo, 112-0011, Japan
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>japanese_full</TableCell>
                  <TableCell>都・道・府・県 を含む</TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>
                    東京都江戸川区篠崎町4-28-16 栞101
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>unknown</TableCell>
                  <TableCell>上記以外（推測しない）</TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>渋谷区1-2-3</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* フラグ一覧 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">フラグ一覧</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>フラグ</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>意味</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>対処法</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Object.keys(FLAG_LABELS) as AddressFlag[]).map((flag) => (
                  <TableRow key={flag}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {flag}
                    </TableCell>
                    <TableCell>{FLAG_LABELS[flag]}</TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>
                      {getFlagSolution(flag)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
    </>
  );
}

function getFlagSolution(flag: AddressFlag): string {
  const solutions: Record<AddressFlag, string> = {
    MISSING_ADDRESS: '住所を入力してください',
    PLACEHOLDER_ADDRESS: '正しい住所に置き換えてください',
    UNKNOWN_FORMAT: '形式を確認し、手動で分割してください',
    HAS_FLOAT_PREFIX: '先頭の小数を削除してください',
    MISSING_PREFECTURE: '都道府県を補完してください',
    MISSING_CITY: '市区町村を補完してください',
    MISSING_NUMBER_BLOCK: '番地を確認してください',
    NEED_REVIEW_PREFECTURE: '都道府県が正しいか確認してください',
    NEED_REVIEW_CITY: '市区町村を日本語に変換してください',
    NEED_REVIEW_NUMBER: '番地の区切りを確認してください',
    NEED_REVIEW_BUILDING: '建物名を確認してください',
    NEED_REVIEW_ROOM_BUILDING: '部屋番号と建物名を確認してください',
    PREF_MISMATCH_SUSPECT: '都道府県の日英が一致するか確認してください',
    HAS_NON_ADDRESS_TOKENS: '非住所文字列を削除してください',
    PARSE_ERROR: '手動で住所を分割してください',
    POSTAL_INVALID_FORMAT: '郵便番号の形式を確認してください（7桁数字）',
    POSTAL_NOT_FOUND: '郵便番号が存在しないか誤りがあります',
    POSTAL_MISMATCH: '郵便番号と住所が一致しません。どちらかを確認してください',
    POSTAL_MULTI_TOWN: '複数町域に該当するため町域は特定不可（要確認）',
    LABEL_HAS_ENGLISH: 'ラベルに英語が含まれています。日本語に変換してください',
    LABEL_HAS_COMMA: 'ラベルにカンマが含まれています。削除してください',
    ENGLISH_BUILDING_ACCEPTED: '英語建物名が許容されました（対応不要）',
    NEED_REVIEW_TOWN: '町域を確認してください（複数候補または不明確）',
    AUTO_COMPLETED_FROM_POSTAL: '郵便番号から自動補完されました（対応不要）',
    NUMBER_BLOCK_SINGLE_ACCEPTED: '単独番地として許容されました（対応不要）',
    NEED_CUSTOMER_CONFIRM: '顧客に直接確認してください',
    POSTAL_AMBIGUOUS: '郵便番号に複数候補がありますが、入力された住所を優先して処理しました（対応不要）',
    PHONE_IN_NUMBER_BLOCK: '番地欄に電話番号が混入しています。電話番号欄に移動してください',
    AUTO_ZERO_RESTORED_MOBILE: '携帯番号の0落ちを自動補正しました（対応不要）',
    NEED_REVIEW_PHONE: '電話番号を確認してください（11桁以外または050）',
  };
  return solutions[flag];
}
