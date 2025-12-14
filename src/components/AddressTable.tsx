'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import { OutputRow, AddressFlag } from '@/types';
import { FLAG_LABELS, BLOCKING_FLAGS } from '@/constants/flags';
import { LabelPreview } from './LabelPreview';

interface AddressTableProps {
  data: OutputRow[];
  originalColumns: string[];
  includeOriginalColumns: boolean;
}

// 結果列の順序（優先度順）
const RESULT_COLUMNS = [
  { key: 'original', label: '元住所' },
  { key: 'label_line1', label: 'ラベル1行目' },
  { key: 'label_line2', label: 'ラベル2行目' },
  { key: 'flags', label: 'フラグ' },
  { key: 'confidence', label: '信頼度' },
  { key: 'format_type', label: '形式' },
  { key: 'prefecture', label: '都道府県' },
  { key: 'city', label: '市区町村' },
  { key: 'town', label: '町域' },
  { key: 'number_block', label: '番地' },
  { key: 'building', label: '建物' },
  { key: 'room', label: '部屋' },
  { key: 'postal_code', label: '郵便番号' },
  { key: 'normalized', label: '正規化後' },
  { key: 'suggestion', label: '提案' },
];

export function AddressTable({
  data,
  originalColumns,
  includeOriginalColumns,
}: AddressTableProps) {
  const [selectedRow, setSelectedRow] = useState<OutputRow | null>(null);

  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">データがありません</Typography>
      </Box>
    );
  }

  // 表示する列を構築
  const displayColumns = [
    ...(includeOriginalColumns
      ? originalColumns.map((col) => ({ key: `_orig_${col}`, label: col }))
      : []),
    ...RESULT_COLUMNS,
  ];

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
    <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto', flex: 1 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            {displayColumns.map((col) => (
              <TableCell
                key={col.key}
                sx={{
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'grey.100',
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={index}
              onClick={() => setSelectedRow(row)}
              sx={{
                backgroundColor: row.flags ? 'warning.light' : 'inherit',
                '&:hover': { backgroundColor: 'action.hover' },
                cursor: 'pointer',
              }}
            >
              {displayColumns.map((col) => {
                let value: string | number = '';

                if (col.key.startsWith('_orig_')) {
                  // 元列
                  const origCol = col.key.replace('_orig_', '');
                  value = row._originalColumns?.[origCol] || '';
                } else {
                  // 結果列
                  value = row[col.key as keyof OutputRow] as string | number;
                }

                // フラグ列の表示
                if (col.key === 'flags' && value) {
                  return (
                    <TableCell key={col.key}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {String(value)
                          .split('|')
                          .map((flag) => {
                            const flagKey = flag as AddressFlag;
                            const isBlocking = BLOCKING_FLAGS.includes(flagKey);
                            const isMismatch = flag === 'POSTAL_MISMATCH';
                            return (
                              <Chip
                                key={flag}
                                label={FLAG_LABELS[flagKey] || flag}
                                size="small"
                                color={isBlocking ? 'error' : isMismatch ? 'warning' : 'default'}
                                variant={isMismatch ? 'filled' : 'outlined'}
                              />
                            );
                          })}
                      </Box>
                    </TableCell>
                  );
                }

                // 信頼度の表示
                if (col.key === 'confidence') {
                  const conf = Number(value);
                  return (
                    <TableCell key={col.key}>
                      <Chip
                        label={`${Math.round(conf * 100)}%`}
                        size="small"
                        color={
                          conf >= 0.8
                            ? 'success'
                            : conf >= 0.6
                            ? 'warning'
                            : 'error'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                  );
                }

                return (
                  <TableCell
                    key={col.key}
                    sx={{
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={String(value)}
                  >
                    {value}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    {/* ラベルプレビュー */}
    {selectedRow && (
      <Box sx={{ position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
        <LabelPreview row={selectedRow} onClose={() => setSelectedRow(null)} />
      </Box>
    )}
    </Box>
  );
}
