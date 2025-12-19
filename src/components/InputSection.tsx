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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LockIcon from '@mui/icons-material/Lock';
import LocalPostOfficeIcon from '@mui/icons-material/LocalPostOffice';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Papa from 'papaparse';
import { OutputRow } from '@/types';
import { processAddresses, processColumnMappedAddresses } from '@/lib/processAddresses';
import { isPostalDataLoaded } from '@/lib/postalLookup';

// 入力モード
type InputMode = 'single_column' | 'column_mapped';

// 列マッピング設定
interface ColumnMapping {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  chome: string;  // 丁目列
  numberBlock: string;
  building: string;
  email: string; // 任意
  phone: string;       // 電話番号列
  name: string;        // お届け先名列
  nameKana: string;    // お届け先名（カナ）列
}

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

  // 入力モード（1列住所解析 vs 列マッピング）
  const [inputMode, setInputMode] = useState<InputMode>('single_column');

  // 列マッピング設定
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    postalCode: '',
    prefecture: '',
    city: '',
    town: '',
    chome: '',
    numberBlock: '',
    building: '',
    email: '',
    phone: '',      // 追加
    name: '',       // 追加
    nameKana: '',   // 追加
  });

  // 単独数字を番地として採用するトグル
  const [acceptSingleNumber, setAcceptSingleNumber] = useState(false);

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

      // CSVパース（dynamicTyping: false で0落ち対策）
      Papa.parse<Record<string, string>>(selectedFile, {
        header: true,
        encoding: 'UTF-8',
        skipEmptyLines: true,
        dynamicTyping: false, // 重要：郵便番号の先頭ゼロ消失を防ぐ
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

          // 列マッピングの自動検出
          const autoMapping: ColumnMapping = {
            postalCode: cols.find(c =>
              c.includes('郵便') || c.includes('postal') || c.includes('〒') || c.toLowerCase().includes('zip')
            ) || '',
            prefecture: cols.find(c =>
              c.includes('都道府県') || c.includes('prefecture') || c === '県'
            ) || '',
            city: cols.find(c =>
              c.includes('市区町村') || c.includes('city') || c === '市' || c === '区'
            ) || '',
            town: cols.find(c =>
              c.includes('町域') || c.includes('町名') || c.includes('town')
            ) || '',
            chome: cols.find(c =>
              c.includes('丁目') || c.toLowerCase().includes('chome')
            ) || '',
            numberBlock: cols.find(c =>
              c.includes('番地') || c.includes('番号') || c.includes('number') || c.includes('street')
            ) || '',
            building: cols.find(c =>
              c.includes('建物') || c.includes('マンション') || c.includes('アパート') || c.includes('部屋') || c.includes('building') || c.includes('room')
            ) || '',
            email: cols.find(c =>
              c.toLowerCase().includes('email') || c.toLowerCase().includes('mail') || c.includes('メール')
            ) || '',
            phone: cols.find(c =>
              c.includes('電話') || c.includes('TEL') || c.toLowerCase().includes('phone')
            ) || (cols.length >= 8 ? cols[7] : ''),  // デフォルトH列（0始まりで7）
            name: cols.find(c =>
              c.includes('名前') || c.includes('氏名') || c.toLowerCase().includes('name')
            ) || (cols.length >= 1 ? cols[0] : ''),  // デフォルトA列（0始まりで0）
            nameKana: cols.find(c =>
              c.includes('フリガナ') || c.includes('ふりがな') || c.includes('カナ') || c.toLowerCase().includes('kana')
            ) || (cols.length >= 2 ? cols[1] : ''),  // デフォルトB列（0始まりで1）
          };
          setColumnMapping(autoMapping);
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
      let originalData: Record<string, string>[] = [];
      let originalColumns: string[] = [];

      if (mode === 'csv') {
        originalData = csvData;
        originalColumns = columns;

        // 列マッピングモードの場合
        if (inputMode === 'column_mapped') {
          // 郵便番号照合ONで辞書未読み込みの場合、ローディング表示
          if (enablePostalVerification && !isPostalDataLoaded()) {
            setLoadingStatus('郵便番号辞書を読み込み中...');
          }

          const results = await processColumnMappedAddresses(
            csvData,
            {
              postalCode: columnMapping.postalCode,
              prefecture: columnMapping.prefecture,
              city: columnMapping.city,
              town: columnMapping.town,
              chome: columnMapping.chome,
              numberBlock: columnMapping.numberBlock,
              building: columnMapping.building,
              email: columnMapping.email,
              phone: columnMapping.phone,
              name: columnMapping.name,
              nameKana: columnMapping.nameKana,
            },
            {
              enablePostalVerification,
              acceptSingleNumber,
            }
          );

          setLoadingStatus(null);
          onProcess(results, includeOriginalColumns ? originalColumns : []);
          return;
        }

        // 1列住所解析モードの場合（従来の処理）
        if (!selectedColumn) {
          onError('住所列を選択してください。');
          setIsProcessing(false);
          return;
        }
        // 住所値の取得（トリミングして確実に取得）
        const addresses = csvData.map((row) => {
          const value = row[selectedColumn];
          return value !== undefined && value !== null ? String(value).trim() : '';
        });

        // 郵便番号照合ONで辞書未読み込みの場合、ローディング表示
        if (enablePostalVerification && !isPostalDataLoaded()) {
          setLoadingStatus('郵便番号辞書を読み込み中...');
        }

        // 処理実行（非同期）
        const results = await processAddresses(
          addresses,
          includeOriginalColumns ? originalData : [],
          { enablePostalVerification, acceptSingleNumber }
        );

        setLoadingStatus(null);
        onProcess(results, includeOriginalColumns ? originalColumns : []);
      } else {
        // テキスト入力モード
        const addresses = textInput
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (addresses.length === 0) {
          onError('住所を入力してください。');
          setIsProcessing(false);
          return;
        }

        // 郵便番号照合ONで辞書未読み込みの場合、ローディング表示
        if (enablePostalVerification && !isPostalDataLoaded()) {
          setLoadingStatus('郵便番号辞書を読み込み中...');
        }

        // 処理実行（非同期）
        const results = await processAddresses(
          addresses,
          [],
          { enablePostalVerification, acceptSingleNumber }
        );

        setLoadingStatus(null);
        onProcess(results, []);
      }
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
    inputMode,
    columnMapping,
    acceptSingleNumber,
    onProcess,
    onError,
  ]);

  // 列マッピング選択用のヘルパー
  const renderColumnSelect = (
    label: string,
    field: keyof ColumnMapping,
    required: boolean = false
  ) => (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel>{label}{required ? ' *' : ''}</InputLabel>
      <Select
        value={columnMapping[field]}
        label={`${label}${required ? ' *' : ''}`}
        onChange={(e) => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
      >
        <MenuItem value="">(選択しない)</MenuItem>
        {columns.map((col) => (
          <MenuItem key={col} value={col}>
            {col}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

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
              sx={{ cursor: 'pointer' }}
            >
              ファイルを選択
              <input
                type="file"
                accept=".csv"
                style={{
                  clip: 'rect(0 0 0 0)',
                  clipPath: 'inset(50%)',
                  height: 1,
                  overflow: 'hidden',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  whiteSpace: 'nowrap',
                  width: 1,
                }}
                onChange={handleFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" color="text.secondary">
                {file.name}
              </Typography>
            )}
          </Box>

          {/* 入力モード切り替え */}
          {columns.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                入力モード
              </Typography>
              <ToggleButtonGroup
                value={inputMode}
                exclusive
                onChange={(_, value) => value && setInputMode(value)}
                size="small"
              >
                <ToggleButton value="single_column">
                  1列住所を解析
                </ToggleButton>
                <ToggleButton value="column_mapped">
                  列が分かれているCSV
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* 1列住所解析モード：列選択 */}
          {columns.length > 0 && inputMode === 'single_column' && (
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

          {/* 列マッピングモード：各列のマッピング */}
          {columns.length > 0 && inputMode === 'column_mapped' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                各列を対応するフィールドにマッピングしてください
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {renderColumnSelect('郵便番号列', 'postalCode')}
                {renderColumnSelect('都道府県列', 'prefecture')}
                {renderColumnSelect('市区町村列', 'city')}
                {renderColumnSelect('町域列', 'town')}
                {renderColumnSelect('丁目列', 'chome')}
                {renderColumnSelect('番地列', 'numberBlock')}
                {renderColumnSelect('建物・部屋番号列', 'building')}
                {renderColumnSelect('メール列（任意）', 'email')}
                {renderColumnSelect('電話番号列', 'phone')}
                {renderColumnSelect('お届け先名列', 'name')}
                {renderColumnSelect('お届け先名（カナ）列', 'nameKana')}
              </Box>

              {/* 郵便番号ゼロ落ち警告 */}
              <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                sx={{ mt: 2 }}
              >
                <Typography variant="caption" fontWeight="bold">
                  郵便番号の先頭ゼロ消失について
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  郵便番号が6桁以下の場合、CSVを作成したソフト（Excel等）で先頭の0が消えている可能性があります。
                  元データ側で修正してください。
                </Typography>
              </Alert>
            </Box>
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

        {/* 単独数字を番地として採用するトグル */}
        <Tooltip
          title="ONにすると、「431」のような単独数字を番地として採用します（要確認フラグは残ります）"
          placement="right"
        >
          <FormControlLabel
            control={
              <Switch
                checked={acceptSingleNumber}
                onChange={(e) => setAcceptSingleNumber(e.target.checked)}
                color="primary"
              />
            }
            label="単独数字を番地として採用する"
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
