'use client';

import { useState, useCallback, useMemo } from 'react';
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
import EditIcon from '@mui/icons-material/Edit';
import { OutputRow, AddressFlag, DraftFields, DraftRowsMap } from '@/types';
import { FLAG_LABELS, BLOCKING_FLAGS, WARNING_FLAGS } from '@/constants/flags';
import { LabelPreview } from './LabelPreview';

// 編集可能な列
const EDITABLE_COLUMNS = [
  'prefecture',
  'city',
  'town',
  'number_block',
  'building',
  'room',
  'postal_code',
];

interface AddressTableProps {
  data: OutputRow[];
  originalColumns: string[];
  includeOriginalColumns: boolean;
  draftRows: DraftRowsMap;
  onDraftUpdate: (rowId: string, patch: DraftFields) => void;
  onRevertDraft: (rowId: string) => void;
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
  { key: 'chome', label: '丁目' },
  { key: 'number_block', label: '番地' },
  { key: 'building', label: '建物' },
  { key: 'room', label: '部屋' },
  { key: 'postal_code', label: '郵便番号' },
  { key: 'phone', label: '電話番号' },
  { key: 'normalized', label: '正規化後' },
  { key: 'suggestion', label: '提案' },
];

export function AddressTable({
  data,
  originalColumns,
  includeOriginalColumns,
  draftRows,
  onDraftUpdate,
  onRevertDraft,
}: AddressTableProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<OutputRow | null>(null);

  // 行がフラグ付き（編集対象）かどうか
  const isRowFlagged = useCallback((row: OutputRow): boolean => {
    if (!row.flags) return false;
    const flagList = row.flags.split('|').filter(Boolean) as AddressFlag[];
    return flagList.some(
      (f) => BLOCKING_FLAGS.includes(f) || WARNING_FLAGS.includes(f)
    );
  }, []);

  // 行クリック（ラベルプレビュー用）
  const handleRowClick = useCallback((row: OutputRow) => {
    setSelectedRowId(row.__rowId);
    setSelectedRowData(row);
  }, []);

  // 選択中の行（ドラフトを適用した表示用）
  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    const baseRow = data.find((row) => row.__rowId === selectedRowId) || selectedRowData;
    if (!baseRow) return null;

    const draft = draftRows[baseRow.__rowId];
    if (!draft) return baseRow;

    // ドラフトをマージ（表示用、フラグ再計算はしない）
    return { ...baseRow, ...draft };
  }, [selectedRowId, data, selectedRowData, draftRows]);

  // 行の値を取得（ドラフト優先）
  const getRowValue = useCallback((row: OutputRow, key: string): string | number => {
    const draft = draftRows[row.__rowId];
    if (draft && key in draft) {
      return (draft as Record<string, unknown>)[key] as string | number;
    }
    return row[key as keyof OutputRow] as string | number;
  }, [draftRows]);

  // ドラフトがあるか
  const hasDraft = useCallback((rowId: string): boolean => {
    return !!draftRows[rowId];
  }, [draftRows]);

  if (data.length === 0 && !selectedRow) {
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
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.100', width: 40 }}>
                {/* 未保存アイコン列 */}
              </TableCell>
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
            {data.map((row) => {
              const isDraft = hasDraft(row.__rowId);
              return (
                <TableRow
                  key={row.__rowId}
                  onClick={() => handleRowClick(row)}
                  sx={{
                    backgroundColor: isDraft
                      ? 'info.light'
                      : row.flags
                        ? 'warning.light'
                        : 'inherit',
                    '&:hover': { backgroundColor: 'action.hover' },
                    cursor: 'pointer',
                  }}
                >
                  {/* 未保存アイコン */}
                  <TableCell sx={{ width: 40, p: 0.5 }}>
                    {isDraft && (
                      <Chip
                        icon={<EditIcon sx={{ fontSize: 14 }} />}
                        label="編集中"
                        size="small"
                        color="info"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                  </TableCell>

                  {displayColumns.map((col) => {
                    let value: string | number = '';

                    if (col.key.startsWith('_orig_')) {
                      const origCol = col.key.replace('_orig_', '');
                      value = row._originalColumns?.[origCol] || '';
                    } else {
                      // ドラフト優先で値を取得
                      value = getRowValue(row, col.key);
                    }

                    // フラグ列の表示（元のフラグを表示、ドラフトによる変更は保存後に反映）
                    if (col.key === 'flags' && row.flags) {
                      return (
                        <TableCell key={col.key}>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {row.flags.split('|').map((flag) => {
                              const flagKey = flag as AddressFlag;
                              const isBlocking = BLOCKING_FLAGS.includes(flagKey);
                              const isMismatch = flag === 'POSTAL_MISMATCH';
                              const isAmbiguous = flag === 'POSTAL_AMBIGUOUS';
                              // POSTAL_AMBIGUOUS は INFO扱い（ブルー系、outlined）
                              return (
                                <Chip
                                  key={flag}
                                  label={FLAG_LABELS[flagKey] || flag}
                                  size="small"
                                  color={
                                    isBlocking ? 'error' :
                                    isMismatch ? 'warning' :
                                    isAmbiguous ? 'info' :
                                    'default'
                                  }
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
                      const conf = Number(row.confidence);
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

                    // 電話番号の表示
                    if (col.key === 'phone') {
                      const phone = row._phone;
                      const hasAutoZeroFlag = phone?.flags?.includes('AUTO_ZERO_RESTORED_MOBILE');
                      return (
                        <TableCell key={col.key}>
                          {phone?.formatted ? (
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                              <Typography variant="body2">{phone.formatted}</Typography>
                              {hasAutoZeroFlag && (
                                <Chip
                                  label="0補正"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      );
                    }

                    // 編集可能セルかどうかを視覚的に表示
                    const isEditable = EDITABLE_COLUMNS.includes(col.key) && isRowFlagged(row);
                    // ドラフトで変更されているか
                    const draft = draftRows[row.__rowId];
                    const isModified = draft && col.key in draft;

                    return (
                      <TableCell
                        key={col.key}
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          backgroundColor: isModified
                            ? 'info.100'
                            : isEditable
                              ? 'action.hover'
                              : 'inherit',
                          fontWeight: isModified ? 'bold' : 'normal',
                        }}
                        title={String(value || '')}
                      >
                        {value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ラベルプレビュー */}
      {selectedRow && (
        <Box sx={{ position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
          <LabelPreview
            row={selectedRow}
            draft={draftRows[selectedRow.__rowId]}
            hasDraft={hasDraft(selectedRow.__rowId)}
            onClose={() => setSelectedRowId(null)}
            onDraftUpdate={(patch) => onDraftUpdate(selectedRow.__rowId, patch)}
            onRevertDraft={() => onRevertDraft(selectedRow.__rowId)}
          />
        </Box>
      )}
    </Box>
  );
}
