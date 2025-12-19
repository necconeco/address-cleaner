'use client';

import { useMemo, useState } from 'react';
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EmailIcon from '@mui/icons-material/Email';
import CheckIcon from '@mui/icons-material/Check';
import { AddressTable } from './AddressTable';
import { OutputRow, ProcessingSummary, FilterState, FormatType, CategoryType, DraftFields, DraftRowsMap } from '@/types';
import { FLAG_LABELS, QUICK_FILTER_FLAGS, BLOCKING_FLAGS, WARNING_FLAGS, CUSTOMER_CONFIRM_FLAGS } from '@/constants/flags';
import { AddressFlag } from '@/types';
import { exportToCsv, exportToYamatoB2Csv, exportToYamatoB2FullCsv, exportToCustomerConfirmCsv, exportToSagawaEhidenCsv, exportToYupackCsv, YamatoExportOptions } from '@/lib/csvExport';
import ContactMailIcon from '@mui/icons-material/ContactMail';

// 確認依頼文テンプレート
function generateConfirmationMessage(row: OutputRow, customerName?: string): string {
  const parsedAddress = [
    row.prefecture,
    row.city,
    row.town,
    row.number_block,
    row.building,
    row.room,
  ].filter(Boolean).join(' ');

  const name = customerName || 'お客様';
  const reason = row.customerConfirmReason || '住所情報に確認が必要な点があります';

  return `${name}様

ご注文いただきありがとうございます。

お届け先住所について確認させていただきたい点がございます。

【ご登録住所】
${row.original || '（登録なし）'}

【解析結果】
${parsedAddress}

【確認理由】
${reason}

お手数ですが、正しい住所をご返信いただけますと幸いです。

よろしくお願いいたします。`;
}

// 行のカテゴリを判定
function categorizeRow(row: OutputRow): 'empty' | 'needs_fix' | 'ok' | 'customer_confirm' {
  const flagList = row.flags ? row.flags.split('|').filter(Boolean) as AddressFlag[] : [];

  // 顧客確認フラグがあるかチェック（最優先）
  const hasCustomerConfirm = flagList.some(f => CUSTOMER_CONFIRM_FLAGS.includes(f));
  if (hasCustomerConfirm) {
    return 'customer_confirm';
  }

  // 未入力: 都道府県と市区町村の両方がない（主要な住所情報がない状態）
  const isEmpty = !row.prefecture && !row.city;

  if (isEmpty) {
    return 'empty';
  }

  // blocking/warningフラグがあるかチェック
  const hasBlockingOrWarning = flagList.some(
    f => BLOCKING_FLAGS.includes(f) || WARNING_FLAGS.includes(f)
  );

  if (hasBlockingOrWarning) {
    return 'needs_fix';
  }

  return 'ok';
}

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
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<string | null>(null);
  const [exportGuardDialog, setExportGuardDialog] = useState<{
    open: boolean;
    action: 'all' | 'flagged' | 'yamato' | 'yamato_nekopos' | 'sagawa' | 'yupack' | 'customer_confirm' | null;
  }>({ open: false, action: null });

  // ヤマトB2出力オプション
  const [yamatoPostalWithHyphen, setYamatoPostalWithHyphen] = useState(false);

  // 確認依頼文コピー用
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // 保存ステータス表示用
  const [saveStatus, setSaveStatus] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // 下書きがある行数
  const draftCount = Object.keys(draftRows).length;

  // カテゴリ別のカウントを計算
  const categoryCounts = useMemo(() => {
    const counts = { empty: 0, needs_fix: 0, ok: 0, customer_confirm: 0 };
    results.forEach(row => {
      const category = categorizeRow(row);
      counts[category]++;
    });
    return counts;
  }, [results]);

  // 郵便番号から補完可能な件数を計算
  const completableCount = useMemo(() => {
    return results.filter(row => {
      // 郵便番号があり、都道府県または市区町村が欠けている行
      const hasPostal = row.postal_code && row.postal_code.length >= 7;
      const needsCompletion = !row.prefecture || !row.city;
      return hasPostal && needsCompletion;
    }).length;
  }, [results]);

  // 顧客確認用データの準備
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

  // 単一行の確認依頼文をコピー
  const handleCopyConfirmMessage = async (row: OutputRow) => {
    const customerName = nameColumn && row._originalColumns?.[nameColumn]
      ? row._originalColumns[nameColumn]
      : undefined;
    const message = generateConfirmationMessage(row, customerName);

    try {
      await navigator.clipboard.writeText(message);
      setCopiedRowId(row.__rowId);
      setTimeout(() => setCopiedRowId(null), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました', err);
    }
  };

  // 全件の確認依頼文を一括コピー
  const handleCopyAllConfirmMessages = async () => {
    const messages = customerConfirmRows.map(row => {
      const customerName = nameColumn && row._originalColumns?.[nameColumn]
        ? row._originalColumns[nameColumn]
        : undefined;
      const email = emailColumn && row._originalColumns?.[emailColumn]
        ? row._originalColumns[emailColumn]
        : '（メールアドレス不明）';
      return `━━━ ${email} ━━━\n${generateConfirmationMessage(row, customerName)}`;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(messages);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました', err);
    }
  };

  // mailtoリンクを生成
  const generateMailtoLink = (row: OutputRow): string | null => {
    if (!emailColumn || !row._originalColumns?.[emailColumn]) return null;
    const email = row._originalColumns[emailColumn];
    const customerName = nameColumn && row._originalColumns?.[nameColumn]
      ? row._originalColumns[nameColumn]
      : undefined;
    const message = generateConfirmationMessage(row, customerName);
    const subject = encodeURIComponent('【ご確認】お届け先住所について');
    const body = encodeURIComponent(message);
    return `mailto:${email}?subject=${subject}&body=${body}`;
  };

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

  // フィルタ適用
  const filteredResults = useMemo(() => {
    return results.filter((row) => {
      // カテゴリフィルタ
      if (filter.category !== 'all') {
        const rowCategory = categorizeRow(row);
        if (rowCategory !== filter.category) {
          return false;
        }
      }

      // 要確認のみ（旧フィルタ、カテゴリフィルタと併用可能）
      if (filter.showOnlyFlagged && !row.flags) {
        return false;
      }

      // format_type別
      if (filter.formatType !== 'all' && row.format_type !== filter.formatType) {
        return false;
      }

      // クイックフィルタ
      if (filter.quickFilter && !row.flags.includes(filter.quickFilter)) {
        return false;
      }

      return true;
    });
  }, [results, filter]);

  // CSV出力（ガードチェック付き）
  const handleExportWithGuard = (action: 'all' | 'flagged' | 'yamato' | 'yamato_nekopos' | 'sagawa' | 'yupack' | 'customer_confirm') => {
    if (draftCount > 0) {
      setExportGuardDialog({ open: true, action });
    } else {
      executeExport(action);
    }
  };

  // 実際のCSV出力
  const executeExport = (action: 'all' | 'flagged' | 'yamato' | 'yamato_nekopos' | 'sagawa' | 'yupack' | 'customer_confirm') => {
    if (action === 'all') {
      exportToCsv(results, originalColumns, includeOriginalColumns, 'address_all.csv');
    } else if (action === 'flagged') {
      const flaggedResults = results.filter((row) => row.flags);
      exportToCsv(flaggedResults, originalColumns, includeOriginalColumns, 'address_needs_review.csv');
    } else if (action === 'yamato') {
      // ヤマトB2形式: OKカテゴリの行のみ出力
      const okResults = results.filter(row => categorizeRow(row) === 'ok');
      const yamatoOptions: YamatoExportOptions = {
        postalWithHyphen: yamatoPostalWithHyphen,
      };
      exportToYamatoB2Csv(okResults, originalColumns, 'yamato_b2.csv', yamatoOptions);
    } else if (action === 'yamato_nekopos') {
      // ヤマトB2クラウド ネコポス用95列形式: OKカテゴリの行のみ出力
      const okResults = results.filter(row => categorizeRow(row) === 'ok');
      exportToYamatoB2FullCsv(okResults, 'yamato_b2_nekopos.csv');
    } else if (action === 'sagawa') {
      // 佐川e飛伝Ⅲ形式: OKカテゴリの行のみ出力
      const okResults = results.filter(row => categorizeRow(row) === 'ok');
      exportToSagawaEhidenCsv(okResults, 'sagawa_ehiden3.csv');
    } else if (action === 'yupack') {
      // ゆうパックプリントR形式: OKカテゴリの行のみ出力
      const okResults = results.filter(row => categorizeRow(row) === 'ok');
      exportToYupackCsv(okResults, 'yupack.csv');
    } else if (action === 'customer_confirm') {
      // 顧客確認用CSV
      const customerConfirmResults = results.filter(row => categorizeRow(row) === 'customer_confirm');
      exportToCustomerConfirmCsv(customerConfirmResults, originalColumns, 'customer_confirm.csv');
    }
    setExportGuardDialog({ open: false, action: null });
  };

  // 保存して出力
  const handleSaveAndExport = () => {
    onSaveDrafts();
    if (exportGuardDialog.action) {
      // 少し遅延させて保存を反映してから出力
      setTimeout(() => {
        executeExport(exportGuardDialog.action!);
      }, 100);
    }
  };

  // 破棄して出力
  const handleDiscardAndExport = () => {
    onDiscardAllDrafts();
    if (exportGuardDialog.action) {
      executeExport(exportGuardDialog.action);
    }
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
      {/* 保存成功ステータス */}
      {saveStatus && (
        <Alert
          severity={saveStatus.type}
          sx={{ mb: 2 }}
          onClose={() => setSaveStatus(null)}
        >
          <Typography variant="body2">{saveStatus.message}</Typography>
        </Alert>
      )}

      {/* 未保存バー */}
      {draftCount > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                color="primary"
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => {
                  const count = draftCount;
                  onSaveDrafts();
                  setSaveStatus({
                    message: `${count}件の変更を保存しました`,
                    type: 'success',
                  });
                  setTimeout(() => setSaveStatus(null), 3000);
                }}
              >
                変更を保存（{draftCount}件）
              </Button>
              <Button
                color="inherit"
                size="small"
                startIcon={<UndoIcon />}
                onClick={() => {
                  onDiscardAllDrafts();
                  setSaveStatus({
                    message: '変更を破棄しました',
                    type: 'info',
                  });
                  setTimeout(() => setSaveStatus(null), 2000);
                }}
              >
                破棄
              </Button>
            </Box>
          }
        >
          <Typography variant="body2">
            <strong>{draftCount}件</strong>の未保存の変更があります
          </Typography>
        </Alert>
      )}

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

          {/* 郵便番号から一括補完 */}
          {onBatchPostalComplete && completableCount > 0 && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={isCompleting ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                onClick={handleBatchComplete}
                disabled={isCompleting}
              >
                郵便番号から住所を補完（{completableCount}件）
              </Button>
              {completionResult && (
                <Typography variant="body2" color="success.main">
                  {completionResult}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* カテゴリタブ */}
      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          value={filter.category}
          exclusive
          onChange={(_, value) => {
            if (value !== null) {
              onFilterChange({
                ...filter,
                category: value as CategoryType,
                quickFilter: null,
              });
            }
          }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: 0,
              borderBottom: '2px solid transparent',
              px: 2,
              py: 1,
              '&.Mui-selected': {
                backgroundColor: 'transparent',
                borderBottomColor: 'primary.main',
                color: 'primary.main',
                fontWeight: 'bold',
              },
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            },
          }}
        >
          <ToggleButton value="all">
            全件 ({results.length})
          </ToggleButton>
          <ToggleButton value="empty" sx={{ color: categoryCounts.empty > 0 ? 'error.main' : 'inherit' }}>
            未入力 ({categoryCounts.empty})
          </ToggleButton>
          <ToggleButton value="needs_fix" sx={{ color: categoryCounts.needs_fix > 0 ? 'warning.main' : 'inherit' }}>
            要修正 ({categoryCounts.needs_fix})
          </ToggleButton>
          <ToggleButton value="ok" sx={{ color: categoryCounts.ok > 0 ? 'success.main' : 'inherit' }}>
            OK ({categoryCounts.ok})
          </ToggleButton>
          <ToggleButton value="customer_confirm" sx={{ color: categoryCounts.customer_confirm > 0 ? 'info.main' : 'inherit' }}>
            顧客確認 ({categoryCounts.customer_confirm})
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* サブフィルタ */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* 顧客確認タブ専用UI */}
      {filter.category === 'customer_confirm' && customerConfirmRows.length > 0 && (
        <Box sx={{
          mb: 2,
          p: 2,
          backgroundColor: 'info.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'info.200',
        }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: 'info.dark' }}>
            顧客確認が必要な住所（{customerConfirmRows.length}件）
          </Typography>

          {/* 一括操作 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={copiedAll ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={handleCopyAllConfirmMessages}
              color={copiedAll ? 'success' : 'primary'}
            >
              {copiedAll ? 'コピーしました' : '全件の確認依頼文をコピー'}
            </Button>
            {emailColumn && (
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                メール列検出: {emailColumn}
              </Typography>
            )}
            {nameColumn && (
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                名前列検出: {nameColumn}
              </Typography>
            )}
          </Box>

          {/* 個別行リスト */}
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {customerConfirmRows.map((row) => {
              const email = emailColumn && row._originalColumns?.[emailColumn];
              const name = nameColumn && row._originalColumns?.[nameColumn];
              const mailtoLink = generateMailtoLink(row);
              const isCopied = copiedRowId === row.__rowId;

              return (
                <Box
                  key={row.__rowId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1,
                    px: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  {/* 名前・メール */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap fontWeight="medium">
                      {name || '（名前なし）'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {email || '（メールなし）'} / {row.original?.slice(0, 30)}...
                    </Typography>
                  </Box>

                  {/* 確認理由 */}
                  <Chip
                    label={row.customerConfirmReason || '要確認'}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ maxWidth: 150 }}
                  />

                  {/* コピーボタン */}
                  <Tooltip title="確認依頼文をコピー">
                    <Button
                      size="small"
                      variant={isCopied ? 'contained' : 'outlined'}
                      color={isCopied ? 'success' : 'primary'}
                      startIcon={isCopied ? <CheckIcon /> : <ContentCopyIcon />}
                      onClick={() => handleCopyConfirmMessage(row)}
                      sx={{ minWidth: 100 }}
                    >
                      {isCopied ? 'コピー済' : 'コピー'}
                    </Button>
                  </Tooltip>

                  {/* mailtoリンク */}
                  {mailtoLink && (
                    <Tooltip title="メーラーで開く（大量送信に注意）">
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<EmailIcon />}
                        href={mailtoLink}
                        component="a"
                        sx={{ minWidth: 80 }}
                      >
                        送信
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
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
      <Box sx={{ mt: 3 }}>
        {/* 標準出力 */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => handleExportWithGuard('all')}
          >
            CSV出力: 全件
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExportWithGuard('flagged')}
          >
            CSV出力: 要確認のみ
          </Button>
          <Button
            variant="contained"
            color="info"
            startIcon={<ContactMailIcon />}
            onClick={() => handleExportWithGuard('customer_confirm')}
            disabled={categoryCounts.customer_confirm === 0}
          >
            顧客確認用CSV ({categoryCounts.customer_confirm}件)
          </Button>
        </Box>

        {/* 配送業者用出力 */}
        <Box sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          p: 2,
          backgroundColor: 'grey.50',
          borderRadius: 1,
          mb: 2,
        }}>
          {/* ヤマトB2 */}
          <Button
            variant="contained"
            color="secondary"
            startIcon={<LocalShippingIcon />}
            onClick={() => handleExportWithGuard('yamato_nekopos')}
            disabled={categoryCounts.ok === 0}
          >
            ヤマトB2ネコポス ({categoryCounts.ok}件)
          </Button>
          {/* 佐川e飛伝Ⅲ */}
          <Button
            variant="contained"
            sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}
            startIcon={<LocalShippingIcon />}
            onClick={() => handleExportWithGuard('sagawa')}
            disabled={categoryCounts.ok === 0}
          >
            佐川e飛伝Ⅲ ({categoryCounts.ok}件)
          </Button>
          {/* ゆうパック */}
          <Button
            variant="contained"
            sx={{ backgroundColor: '#c62828', '&:hover': { backgroundColor: '#b71c1c' } }}
            startIcon={<LocalShippingIcon />}
            onClick={() => handleExportWithGuard('yupack')}
            disabled={categoryCounts.ok === 0}
          >
            ゆうパック ({categoryCounts.ok}件)
          </Button>
          <Typography variant="caption" color="text.secondary">
            OKカテゴリのみ出力
          </Typography>
        </Box>

        {/* 旧ヤマトB2出力（簡易版） */}
        <Box sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          p: 2,
          backgroundColor: 'grey.100',
          borderRadius: 1,
          mb: 2,
        }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<LocalShippingIcon />}
            onClick={() => handleExportWithGuard('yamato')}
            disabled={categoryCounts.ok === 0}
            size="small"
          >
            B2簡易形式: OKのみ ({categoryCounts.ok}件)
          </Button>
          <Tooltip title="B2テンプレートに合わせて郵便番号の形式を選択" placement="top">
            <FormControlLabel
              control={
                <Switch
                  checked={yamatoPostalWithHyphen}
                  onChange={(e) => setYamatoPostalWithHyphen(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2">
                  郵便番号にハイフン付き（{yamatoPostalWithHyphen ? '123-4567' : '1234567'}）
                </Typography>
              }
            />
          </Tooltip>
        </Box>

        {/* クリアボタン */}
        <Button
          variant="text"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onClear}
        >
          結果をクリア
        </Button>
      </Box>

      {/* CSV出力ガードダイアログ */}
      <Dialog
        open={exportGuardDialog.open}
        onClose={() => setExportGuardDialog({ open: false, action: null })}
      >
        <DialogTitle>未保存の変更があります</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {draftCount}件の未保存の変更があります。どうしますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportGuardDialog({ open: false, action: null })}>
            キャンセル
          </Button>
          <Button onClick={handleDiscardAndExport} color="warning">
            破棄して出力
          </Button>
          <Button onClick={handleSaveAndExport} variant="contained" color="primary">
            保存して出力
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
