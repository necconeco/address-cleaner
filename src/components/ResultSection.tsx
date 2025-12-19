'use client';

import { useMemo, useState } from 'react';
import { Box, Alert, Button, Typography } from '@mui/material';
import { AddressTable } from './AddressTable';
import { OutputRow, ProcessingSummary, FilterState, CategoryType, DraftFields, DraftRowsMap } from '@/types';
import {
  exportToCsv,
  exportToYamatoB2Csv,
  exportToYamatoB2FullCsv,
  exportToCustomerConfirmCsv,
  exportToSagawaEhidenCsv,
  exportToYupackCsv,
  YamatoExportOptions,
} from '@/lib/exporters';
import { categorizeRow, getCategoryCounts } from '@/lib/utils';
import {
  DraftBar,
  SummaryPanel,
  CategoryTabs,
  FilterBar,
  CustomerConfirmPanel,
  ExportButtons,
  ExportGuardDialog,
  ExportAction,
} from './result';

interface ResultSectionProps {
  results: OutputRow[];
  originalColumns: string[];
  summary: ProcessingSummary | null;
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  includeOriginalColumns: boolean;
  error: string | null;
  onClear: () => void;
  // 下書き関連
  draftRows: DraftRowsMap;
  onDraftUpdate: (rowId: string, patch: DraftFields) => void;
  onRevertDraft: (rowId: string) => void;
  onSaveDrafts: () => void;
  onDiscardAllDrafts: () => void;
  onBatchPostalComplete?: () => Promise<number>;
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
  draftRows,
  onDraftUpdate,
  onRevertDraft,
  onSaveDrafts,
  onDiscardAllDrafts,
  onBatchPostalComplete,
}: ResultSectionProps) {
  // ローカル状態
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<string | null>(null);
  const [exportGuardDialog, setExportGuardDialog] = useState<{
    open: boolean;
    action: ExportAction | null;
  }>({ open: false, action: null });
  const [yamatoPostalWithHyphen, setYamatoPostalWithHyphen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // 下書きがある行数
  const draftCount = Object.keys(draftRows).length;

  // カテゴリ別のカウント
  const categoryCounts = useMemo(() => getCategoryCounts(results), [results]);

  // 郵便番号から補完可能な件数
  const completableCount = useMemo(() => {
    return results.filter(row => {
      const hasPostal = row.postal_code && row.postal_code.length >= 7;
      const needsCompletion = !row.prefecture || !row.city;
      return hasPostal && needsCompletion;
    }).length;
  }, [results]);

  // 顧客確認用データ
  const customerConfirmRows = useMemo(() => {
    return results.filter(row => categorizeRow(row) === 'customer_confirm');
  }, [results]);

  // メール列・名前列の自動検出
  const emailColumn = useMemo(() => {
    return originalColumns.find(col =>
      col.toLowerCase().includes('email') || col.toLowerCase().includes('mail') || col.includes('メール')
    );
  }, [originalColumns]);

  const nameColumn = useMemo(() => {
    return originalColumns.find(col =>
      col.includes('名前') || col.includes('氏名') || col.toLowerCase().includes('name')
    );
  }, [originalColumns]);

  // フィルタ適用
  const filteredResults = useMemo(() => {
    return results.filter((row) => {
      if (filter.category !== 'all') {
        const rowCategory = categorizeRow(row);
        if (rowCategory !== filter.category) return false;
      }
      if (filter.showOnlyFlagged && !row.flags) return false;
      if (filter.formatType !== 'all' && row.format_type !== filter.formatType) return false;
      if (filter.quickFilter && !row.flags.includes(filter.quickFilter)) return false;
      return true;
    });
  }, [results, filter]);

  // 郵便番号から一括補完
  const handleBatchComplete = async () => {
    if (!onBatchPostalComplete) return;
    setIsCompleting(true);
    setCompletionResult(null);
    try {
      const count = await onBatchPostalComplete();
      setCompletionResult(`${count}件を補完しました`);
      setTimeout(() => setCompletionResult(null), 3000);
    } catch {
      setCompletionResult('補完に失敗しました');
    } finally {
      setIsCompleting(false);
    }
  };

  // CSV出力（ガードチェック付き）
  const handleExportWithGuard = (action: ExportAction) => {
    if (draftCount > 0) {
      setExportGuardDialog({ open: true, action });
    } else {
      executeExport(action);
    }
  };

  // 実際のCSV出力
  const executeExport = (action: ExportAction) => {
    const okResults = results.filter(row => categorizeRow(row) === 'ok');
    const yamatoOptions: YamatoExportOptions = { postalWithHyphen: yamatoPostalWithHyphen };

    switch (action) {
      case 'all':
        exportToCsv(results, originalColumns, includeOriginalColumns, 'address_all.csv');
        break;
      case 'flagged':
        exportToCsv(results.filter(row => row.flags), originalColumns, includeOriginalColumns, 'address_needs_review.csv');
        break;
      case 'yamato':
        exportToYamatoB2Csv(okResults, originalColumns, 'yamato_b2.csv', yamatoOptions);
        break;
      case 'yamato_nekopos':
        exportToYamatoB2FullCsv(okResults, 'yamato_b2_nekopos.csv');
        break;
      case 'sagawa':
        exportToSagawaEhidenCsv(okResults, 'sagawa_ehiden3.csv');
        break;
      case 'yupack':
        exportToYupackCsv(okResults, 'yupack.csv');
        break;
      case 'customer_confirm':
        exportToCustomerConfirmCsv(customerConfirmRows, originalColumns, 'customer_confirm.csv');
        break;
    }
    setExportGuardDialog({ open: false, action: null });
  };

  // 保存して出力
  const handleSaveAndExport = () => {
    onSaveDrafts();
    if (exportGuardDialog.action) {
      setTimeout(() => executeExport(exportGuardDialog.action!), 100);
    }
  };

  // 破棄して出力
  const handleDiscardAndExport = () => {
    onDiscardAllDrafts();
    if (exportGuardDialog.action) {
      executeExport(exportGuardDialog.action);
    }
  };

  // 保存ハンドラ
  const handleSave = () => {
    const count = draftCount;
    onSaveDrafts();
    setSaveStatus({ message: `${count}件の変更を保存しました`, type: 'success' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // 破棄ハンドラ
  const handleDiscard = () => {
    onDiscardAllDrafts();
    setSaveStatus({ message: '変更を破棄しました', type: 'info' });
    setTimeout(() => setSaveStatus(null), 2000);
  };

  // カテゴリ変更ハンドラ
  const handleCategoryChange = (category: CategoryType) => {
    onFilterChange({ ...filter, category, quickFilter: null });
  };

  // エラー表示
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
      {/* 保存成功ステータス */}
      {saveStatus && (
        <Alert severity={saveStatus.type} sx={{ mb: 2 }} onClose={() => setSaveStatus(null)}>
          <Typography variant="body2">{saveStatus.message}</Typography>
        </Alert>
      )}

      {/* 未保存バー */}
      <DraftBar draftCount={draftCount} onSave={handleSave} onDiscard={handleDiscard} />

      {/* サマリー */}
      {summary && (
        <SummaryPanel
          summary={summary}
          completableCount={completableCount}
          isCompleting={isCompleting}
          completionResult={completionResult}
          onBatchComplete={onBatchPostalComplete ? handleBatchComplete : undefined}
        />
      )}

      {/* カテゴリタブ */}
      <CategoryTabs
        category={filter.category}
        counts={categoryCounts}
        totalCount={results.length}
        onChange={handleCategoryChange}
      />

      {/* サブフィルタ */}
      <FilterBar filter={filter} onFilterChange={onFilterChange} />

      {/* 顧客確認タブ専用UI */}
      {filter.category === 'customer_confirm' && (
        <CustomerConfirmPanel
          rows={customerConfirmRows}
          emailColumn={emailColumn}
          nameColumn={nameColumn}
        />
      )}

      {/* テーブル */}
      <AddressTable
        data={filteredResults}
        originalColumns={originalColumns}
        includeOriginalColumns={includeOriginalColumns}
        draftRows={draftRows}
        onDraftUpdate={onDraftUpdate}
        onRevertDraft={onRevertDraft}
      />

      {/* CSV出力ボタン */}
      <ExportButtons
        categoryCounts={categoryCounts}
        yamatoPostalWithHyphen={yamatoPostalWithHyphen}
        onYamatoPostalToggle={setYamatoPostalWithHyphen}
        onExport={handleExportWithGuard}
        onClear={onClear}
      />

      {/* CSV出力ガードダイアログ */}
      <ExportGuardDialog
        open={exportGuardDialog.open}
        action={exportGuardDialog.action}
        draftCount={draftCount}
        onClose={() => setExportGuardDialog({ open: false, action: null })}
        onSaveAndExport={handleSaveAndExport}
        onDiscardAndExport={handleDiscardAndExport}
      />
    </Box>
  );
}
