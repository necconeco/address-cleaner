'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { OutputRow, ProcessingSummary, FilterState, AddressFlag, DraftFields, DraftRowsMap } from '@/types';
import { classifyFlags } from '@/constants/flags';
import { completeAddressFromPostal, preloadPostalData } from '@/lib/postalLookup';
import { revalidateFlags } from '@/lib/revalidateFlags';

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
    category: 'all',
  });

  // ヘルプモーダル
  const [helpOpen, setHelpOpen] = useState(false);

  // エラー状態
  const [error, setError] = useState<string | null>(null);

  // 下書き状態（rowId -> partial fields）
  const [draftRows, setDraftRows] = useState<DraftRowsMap>({});

  // 下書きがある行数
  const draftCount = Object.keys(draftRows).length;

  // beforeunload警告（未保存の変更がある場合）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draftCount > 0) {
        e.preventDefault();
        e.returnValue = '未保存の変更があります。ページを離れますか？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftCount]);

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
    setDraftRows({});
  }, []);

  // 下書き更新（即時反映せず、draftに保持）
  const handleDraftUpdate = useCallback(
    (rowId: string, patch: DraftFields) => {
      setDraftRows((prev) => {
        const existingDraft = prev[rowId] || {};
        const newDraft = { ...existingDraft, ...patch };
        // 空のフィールドを削除（元に戻した場合）
        const cleanedDraft = Object.fromEntries(
          Object.entries(newDraft).filter(([, v]) => v !== undefined)
        ) as DraftFields;
        if (Object.keys(cleanedDraft).length === 0) {
          const { [rowId]: _removed, ...rest } = prev;
          void _removed;
          return rest;
        }
        return { ...prev, [rowId]: cleanedDraft };
      });
    },
    []
  );

  // 行の下書きをクリア（元に戻す）
  const handleRevertDraft = useCallback(
    (rowId: string) => {
      setDraftRows((prev) => {
        const { [rowId]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      });
    },
    []
  );

  // 全下書きを破棄
  const handleDiscardAllDrafts = useCallback(() => {
    setDraftRows({});
  }, []);

  // サマリー計算ヘルパー
  const calculateSummary = useCallback((rows: OutputRow[]): ProcessingSummary => {
    const total = rows.length;
    let ok = 0;
    let needsReview = 0;
    let errorCount = 0;

    rows.forEach((row) => {
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
    return { total, ok, needsReview, error: errorCount, successRate };
  }, []);

  // 下書きを保存（確定）
  const handleSaveDrafts = useCallback(() => {
    if (draftCount === 0) return;

    setResults((prev) => {
      const newResults = prev.map((row) => {
        const draft = draftRows[row.__rowId];
        if (!draft) return row;

        // 下書きをマージ
        const updatedRow = { ...row, ...draft };

        // flagsとラベルを再評価（customerConfirmReasonを渡す）
        const revalidated = revalidateFlags(updatedRow, draft.customerConfirmReason);
        updatedRow.flags = revalidated.flags;
        updatedRow.label_line1 = revalidated.label_line1;
        updatedRow.label_line2 = revalidated.label_line2;
        updatedRow.confidence = revalidated.confidence;

        return updatedRow;
      });

      // サマリーも更新
      setSummary(calculateSummary(newResults));

      return newResults;
    });

    // 下書きをクリア
    setDraftRows({});
  }, [draftCount, draftRows, calculateSummary]);

  // 郵便番号から一括補完
  const handleBatchPostalComplete = useCallback(async (): Promise<number> => {
    // 郵便番号辞書を読み込み
    await preloadPostalData();

    let completedCount = 0;
    const newResults = [...results];

    for (let i = 0; i < newResults.length; i++) {
      const row = newResults[i];

      // 郵便番号がなければスキップ
      if (!row.postal_code || row.postal_code.length < 7) continue;

      // 既に都道府県と市区町村がある場合はスキップ
      if (row.prefecture && row.city) continue;

      // 郵便番号から補完
      const completion = await completeAddressFromPostal(row.postal_code);
      if (!completion) continue;

      // 補完結果を適用
      const updatedRow = { ...row };

      if (!row.prefecture && completion.prefecture) {
        updatedRow.prefecture = completion.prefecture;
      }
      if (!row.city && completion.city) {
        updatedRow.city = completion.city;
      }
      if (!row.town && completion.town) {
        updatedRow.town = completion.town;
      }

      // フラグを構築
      const existingFlags = row.flags ? row.flags.split('|').filter(Boolean) as AddressFlag[] : [];
      const newFlags = [...existingFlags];

      // AUTO_COMPLETED_FROM_POSTALを追加
      if (!newFlags.includes('AUTO_COMPLETED_FROM_POSTAL')) {
        newFlags.push('AUTO_COMPLETED_FROM_POSTAL');
      }

      // 町域が要確認の場合
      if (completion.needsReviewTown && !newFlags.includes('NEED_REVIEW_TOWN')) {
        newFlags.push('NEED_REVIEW_TOWN');
      }

      updatedRow.flags = newFlags.join('|');

      // flagsとラベルを再評価
      const revalidated = revalidateFlags(updatedRow);
      updatedRow.flags = revalidated.flags;
      updatedRow.label_line1 = revalidated.label_line1;
      updatedRow.label_line2 = revalidated.label_line2;
      updatedRow.confidence = revalidated.confidence;

      newResults[i] = updatedRow;
      completedCount++;
    }

    // 結果を更新
    setResults(newResults);

    // サマリーを再計算
    let ok = 0;
    let needsReview = 0;
    let errorCount = 0;

    newResults.forEach((row) => {
      const { blocking, warning } = classifyFlags(row.flags);
      if (blocking > 0) {
        errorCount++;
      } else if (warning > 0) {
        needsReview++;
      } else {
        ok++;
      }
    });

    const total = newResults.length;
    const successRate = total > 0 ? Math.round((ok / total) * 100) : 0;
    setSummary({ total, ok, needsReview, error: errorCount, successRate });

    return completedCount;
  }, [results]);

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
            draftRows={draftRows}
            onDraftUpdate={handleDraftUpdate}
            onRevertDraft={handleRevertDraft}
            onSaveDrafts={handleSaveDrafts}
            onDiscardAllDrafts={handleDiscardAllDrafts}
            onBatchPostalComplete={handleBatchPostalComplete}
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
