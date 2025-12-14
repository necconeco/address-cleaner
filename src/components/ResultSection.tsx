'use client';

import { useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import { AddressTable } from './AddressTable';
import { OutputRow, ProcessingSummary, FilterState, FormatType } from '@/types';
import { FLAG_LABELS, QUICK_FILTER_FLAGS } from '@/constants/flags';
import { exportToCsv } from '@/lib/csvExport';

interface ResultSectionProps {
  results: OutputRow[];
  originalColumns: string[];
  summary: ProcessingSummary | null;
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  includeOriginalColumns: boolean;
  error: string | null;
  onClear: () => void;
}

export function ResultSection({
  results,
  originalColumns,
  summary,
  filter,
  onFilterChange,
  includeOriginalColumns,
  error,
  onClear,
}: ResultSectionProps) {
  // フィルタ適用
  const filteredResults = useMemo(() => {
    let filtered = results;

    // 要確認のみ
    if (filter.showOnlyFlagged) {
      filtered = filtered.filter((row) => row.flags);
    }

    // format_type別
    if (filter.formatType !== 'all') {
      filtered = filtered.filter((row) => row.format_type === filter.formatType);
    }

    // クイックフィルタ
    if (filter.quickFilter) {
      filtered = filtered.filter((row) =>
        row.flags.includes(filter.quickFilter!)
      );
    }

    return filtered;
  }, [results, filter]);

  // CSV出力（全件）
  const handleExportAll = () => {
    exportToCsv(results, originalColumns, includeOriginalColumns, 'address_all.csv');
  };

  // CSV出力（要確認のみ）
  const handleExportFlagged = () => {
    const flaggedResults = results.filter((row) => row.flags);
    exportToCsv(flaggedResults, originalColumns, includeOriginalColumns, 'address_needs_review.csv');
  };

  if (error) {
    return (
      <Box>
        <Alert
          severity="error"
          action={
            results.length > 0 && (
              <Button color="inherit" size="small" onClick={onClear}>
                結果をクリア
              </Button>
            )
          }
        >
          <Typography variant="subtitle2" fontWeight="bold">
            CSVファイルの読み込みに失敗しました
          </Typography>
          <Typography variant="body2">{error}</Typography>
          {results.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              前回の結果を保持しています
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* サマリー */}
      {summary && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            処理結果
          </Typography>
          <Typography variant="body1">
            {summary.total}件中{' '}
            <Typography component="span" color="success.main" fontWeight="bold">
              {summary.ok}件OK
            </Typography>
            {' / '}
            <Typography component="span" color="warning.main" fontWeight="bold">
              {summary.needsReview}件要確認
            </Typography>
            {' / '}
            <Typography component="span" color="error.main" fontWeight="bold">
              {summary.error}件エラー
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            成功率: {summary.successRate}%
          </Typography>
        </Box>
      )}

      {/* フィルタ */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          {/* 全件/要確認のみ */}
          <ToggleButtonGroup
            value={filter.showOnlyFlagged ? 'flagged' : 'all'}
            exclusive
            onChange={(_, value) => {
              if (value !== null) {
                onFilterChange({
                  ...filter,
                  showOnlyFlagged: value === 'flagged',
                });
              }
            }}
            size="small"
          >
            <ToggleButton value="all">全件</ToggleButton>
            <ToggleButton value="flagged">要確認のみ</ToggleButton>
          </ToggleButtonGroup>

          {/* format_type */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>形式</InputLabel>
            <Select
              value={filter.formatType}
              label="形式"
              onChange={(e) =>
                onFilterChange({
                  ...filter,
                  formatType: e.target.value as FormatType | 'all',
                })
              }
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="google_maps">Google Maps形式</MenuItem>
              <MenuItem value="japanese_full">日本語形式</MenuItem>
              <MenuItem value="unknown">不明</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* クイックフィルタ */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {QUICK_FILTER_FLAGS.map((flag) => (
            <Chip
              key={flag}
              label={FLAG_LABELS[flag]}
              variant={filter.quickFilter === flag ? 'filled' : 'outlined'}
              color={filter.quickFilter === flag ? 'primary' : 'default'}
              onClick={() =>
                onFilterChange({
                  ...filter,
                  quickFilter: filter.quickFilter === flag ? null : flag,
                })
              }
              size="small"
            />
          ))}
        </Box>
      </Box>

      {/* テーブル */}
      <AddressTable
        data={filteredResults}
        originalColumns={originalColumns}
        includeOriginalColumns={includeOriginalColumns}
      />

      {/* CSV出力ボタン */}
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExportAll}
        >
          CSV出力: 全件
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportFlagged}
        >
          CSV出力: 要確認のみ
        </Button>
        <Button
          variant="text"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onClear}
        >
          結果をクリア
        </Button>
      </Box>
    </Box>
  );
}
