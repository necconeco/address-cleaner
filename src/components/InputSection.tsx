'use client';

import { useState, useCallback, ChangeEvent } from 'react';
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Switch,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LockIcon from '@mui/icons-material/Lock';
import LocalPostOfficeIcon from '@mui/icons-material/LocalPostOffice';
import Papa from 'papaparse';
import { OutputRow } from '@/types';
import { processAddresses } from '@/lib/processAddresses';
import { isPostalDataLoaded } from '@/lib/postalLookup';

interface InputSectionProps {
  mode: 'csv' | 'text';
  includeOriginalColumns: boolean;
  onIncludeOriginalColumnsChange: (value: boolean) => void;
  onProcess: (data: OutputRow[], columns: string[]) => void;
  onError: (message: string) => void;
}

export function InputSection({
  mode,
  includeOriginalColumns,
  onIncludeOriginalColumnsChange,
  onProcess,
  onError,
}: InputSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enablePostalVerification, setEnablePostalVerification] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  // CSVファイル選択
  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      // ファイル形式チェック
      if (!selectedFile.name.endsWith('.csv')) {
        onError(
          'CSVファイル（.csv）を選択してください。Excelファイルの場合は「名前を付けて保存」→「CSV UTF-8」で保存してください。'
        );
        return;
      }

      // ファイルサイズチェック（10MB）
      if (selectedFile.size > 10 * 1024 * 1024) {
        onError(
          'ファイルサイズが大きすぎます（上限10MB）。ファイルを分割してください。'
        );
        return;
      }

      setFile(selectedFile);

      // CSVパース
      Papa.parse<Record<string, string>>(selectedFile, {
        header: true,
        encoding: 'UTF-8',
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            onError(
              'ファイルがUTF-8形式ではありません。Excelで開き「名前を付けて保存」→「CSV UTF-8（コンマ区切り）」で保存し直してください。'
            );
            return;
          }

          if (results.data.length === 0) {
            onError(
              'ファイルが空です。住所データが含まれるCSVファイルを選択してください。'
            );
            return;
          }

          // 列名のトリミングとBOM除去
          const cols = (results.meta.fields || []).map((col) =>
            col.replace(/^\uFEFF/, '').trim()
          );
          if (cols.length === 0) {
            onError(
              '列名が検出できませんでした。CSVファイルの1行目に列名（住所、address等）が含まれているか確認してください。'
            );
            return;
          }

          // データの列名もトリミング
          const cleanedData = results.data.map((row) => {
            const cleanedRow: Record<string, string> = {};
            Object.entries(row).forEach(([key, value]) => {
              const cleanKey = key.replace(/^\uFEFF/, '').trim();
              cleanedRow[cleanKey] = value;
            });
            return cleanedRow;
          });

          setColumns(cols);
          setCsvData(cleanedData);

          // 住所列を自動選択
          const addressCol = cols.find(
            (c) =>
              c.includes('住所') ||
              c.toLowerCase().includes('address') ||
              c.includes('addr')
          );
          setSelectedColumn(addressCol || cols[0]);
        },
        error: () => {
          onError(
            '読み込みが中断されました。再度ファイルを選択してください。'
          );
        },
      });
    },
    [onError]
  );

  // 処理実行（非同期対応）
  const handleExecute = useCallback(async () => {
    setIsProcessing(true);

    try {
      let addresses: string[] = [];
      let originalData: Record<string, string>[] = [];
      let originalColumns: string[] = [];

      if (mode === 'csv') {
        if (!selectedColumn) {
          onError('住所列を選択してください。');
          setIsProcessing(false);
          return;
        }
        // 住所値の取得（トリミングして確実に取得）
        addresses = csvData.map((row) => {
          const value = row[selectedColumn];
          return value !== undefined && value !== null ? String(value).trim() : '';
        });
        originalData = csvData;
        originalColumns = columns;
      } else {
        addresses = textInput
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (addresses.length === 0) {
          onError('住所を入力してください。');
          setIsProcessing(false);
          return;
        }
      }

      // 郵便番号照合ONで辞書未読み込みの場合、ローディング表示
      if (enablePostalVerification && !isPostalDataLoaded()) {
        setLoadingStatus('郵便番号辞書を読み込み中...');
      }

      // 処理実行（非同期）
      const results = await processAddresses(
        addresses,
        includeOriginalColumns ? originalData : [],
        { enablePostalVerification }
      );

      setLoadingStatus(null);
      onProcess(results, includeOriginalColumns ? originalColumns : []);
    } catch {
      onError('処理中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
      setLoadingStatus(null);
    }
  }, [
    mode,
    csvData,
    selectedColumn,
    textInput,
    columns,
    includeOriginalColumns,
    enablePostalVerification,
    onProcess,
    onError,
  ]);

  return (
    <Box>
      {mode === 'csv' ? (
        <Box>
          {/* ファイル選択 */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
            >
              ファイルを選択
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={handleFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" color="text.secondary">
                {file.name}
              </Typography>
            )}
          </Box>

          {/* 列選択 */}
          {columns.length > 0 && (
            <FormControl sx={{ minWidth: 200, mb: 2 }}>
              <InputLabel>住所列</InputLabel>
              <Select
                value={selectedColumn}
                label="住所列"
                onChange={(e) => setSelectedColumn(e.target.value)}
              >
                {columns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      ) : (
        <TextField
          multiline
          rows={6}
          fullWidth
          placeholder="1行に1つの住所を入力してください"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          sx={{ mb: 2 }}
        />
      )}

      {/* オプション */}
      <Box sx={{ mb: 2 }}>
        {mode === 'csv' && (
          <FormControlLabel
            control={
              <Checkbox
                checked={includeOriginalColumns}
                onChange={(e) => onIncludeOriginalColumnsChange(e.target.checked)}
              />
            }
            label="元の列を含める"
            sx={{ display: 'block' }}
          />
        )}

        {/* 郵便番号照合トグル */}
        <Tooltip
          title="ONにすると郵便番号辞書（約10MB）を読み込み、住所との整合性をチェックします"
          placement="right"
        >
          <FormControlLabel
            control={
              <Switch
                checked={enablePostalVerification}
                onChange={(e) => setEnablePostalVerification(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocalPostOfficeIcon fontSize="small" />
                郵便番号照合
              </Box>
            }
            sx={{ display: 'block' }}
          />
        </Tooltip>
      </Box>

      {/* プライバシー注意文 */}
      <Alert
        severity="info"
        icon={<LockIcon />}
        sx={{ mb: 2 }}
      >
        データはブラウザ内で処理され、サーバーには送信されません
      </Alert>

      {/* 実行ボタン */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={
            isProcessing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />
          }
          onClick={handleExecute}
          disabled={
            isProcessing ||
            (mode === 'csv' ? !selectedColumn : textInput.trim().length === 0)
          }
        >
          {isProcessing ? '処理中...' : '処理実行'}
        </Button>
        {loadingStatus && (
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            {loadingStatus}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
