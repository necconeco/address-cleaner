'use client';

import { useState, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { InputSection } from '@/components/InputSection';
import { ResultSection } from '@/components/ResultSection';
import { HelpModal } from '@/components/HelpModal';
import { HelpAccordion } from '@/components/HelpAccordion';
import { OutputRow, ProcessingSummary, FilterState } from '@/types';
import { classifyFlags } from '@/constants/flags';

export default function Home() {
  // 入力タブ
  const [inputTab, setInputTab] = useState(0);

  // 元列を含めるチェック
  const [includeOriginalColumns, setIncludeOriginalColumns] = useState(true);

  // 処理結果
  const [results, setResults] = useState<OutputRow[]>([]);
  const [originalColumns, setOriginalColumns] = useState<string[]>([]);
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);

  // フィルタ状態
  const [filter, setFilter] = useState<FilterState>({
    showOnlyFlagged: false,
    formatType: 'all',
    quickFilter: null,
  });

  // ヘルプモーダル
  const [helpOpen, setHelpOpen] = useState(false);

  // エラー状態
  const [error, setError] = useState<string | null>(null);

  // 処理実行
  const handleProcess = useCallback(
    (data: OutputRow[], columns: string[]) => {
      setResults(data);
      setOriginalColumns(columns);

      // サマリー計算（blocking/warning分類）
      const total = data.length;
      let ok = 0;
      let needsReview = 0;
      let errorCount = 0;

      data.forEach((row) => {
        const { blocking, warning } = classifyFlags(row.flags);
        if (blocking > 0) {
          errorCount++;
        } else if (warning > 0) {
          needsReview++;
        } else {
          ok++;
        }
      });

      const successRate = total > 0 ? Math.round((ok / total) * 100) : 0;

      setSummary({ total, ok, needsReview, error: errorCount, successRate });
      setError(null);
    },
    []
  );

  // エラーハンドリング
  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  // 結果クリア
  const handleClear = useCallback(() => {
    setResults([]);
    setOriginalColumns([]);
    setSummary(null);
    setError(null);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1" fontWeight="bold">
          住所クレンジング＆分解ツール
        </Typography>
        <Tooltip title="使い方ガイド">
          <IconButton onClick={() => setHelpOpen(true)} color="primary">
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 入力セクション */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          入力
        </Typography>

        <Tabs
          value={inputTab}
          onChange={(_, v) => setInputTab(v)}
          sx={{ mb: 2 }}
        >
          <Tab label="CSVアップロード" />
          <Tab label="テキスト貼り付け" />
        </Tabs>

        <InputSection
          mode={inputTab === 0 ? 'csv' : 'text'}
          includeOriginalColumns={includeOriginalColumns}
          onIncludeOriginalColumnsChange={setIncludeOriginalColumns}
          onProcess={handleProcess}
          onError={handleError}
        />
      </Paper>

      {/* 結果セクション */}
      {(results.length > 0 || error) && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <ResultSection
            results={results}
            originalColumns={originalColumns}
            summary={summary}
            filter={filter}
            onFilterChange={setFilter}
            includeOriginalColumns={includeOriginalColumns}
            error={error}
            onClear={handleClear}
          />
        </Paper>
      )}

      {/* ヘルプAccordion */}
      <HelpAccordion />

      {/* ヘルプモーダル */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Container>
  );
}
