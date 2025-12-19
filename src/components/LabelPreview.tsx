'use client';

import { useState, useCallback, useRef, memo, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import UndoIcon from '@mui/icons-material/Undo';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import { OutputRow, DraftFields } from '@/types';
import { canAcceptEnglishBuilding } from '@/lib/revalidateFlags';
import { CUSTOMER_CONFIRM_FLAGS } from '@/constants/flags';
import { lookupPostalCode, verifyPostalCode, PostalLookupResult } from '@/lib/postalLookup';

// 解析結果フィールドのラベル定義
const RESULT_FIELD_LABELS: Record<string, string> = {
  original: '元住所',
  normalized: '正規化後',
  format_type: '形式',
  prefecture: '都道府県',
  city: '市区町村',
  town: '町域',
  number_block: '番地',
  building: '建物',
  room: '部屋',
  postal_code: '郵便番号',
  confidence: '信頼度',
  flags: 'フラグ',
  suggestion: '提案',
  label_line1: 'ラベル1行目',
  label_line2: 'ラベル2行目',
};

// 解析結果フィールドの表示順
const RESULT_FIELD_ORDER = [
  'original',
  'format_type',
  'confidence',
  'flags',
  'suggestion',
  'prefecture',
  'city',
  'town',
  'number_block',
  'building',
  'room',
  'postal_code',
  'normalized',
  'label_line1',
  'label_line2',
];

// 編集可能なフィールド
type EditableField = 'prefecture' | 'city' | 'town' | 'number_block' | 'building' | 'room' | 'postal_code';

interface LabelPreviewProps {
  row: OutputRow;
  draft?: DraftFields;
  hasDraft: boolean;
  onClose: () => void;
  onDraftUpdate: (patch: DraftFields) => void;
  onRevertDraft: () => void;
}

// Key-Value表示コンポーネント
const KeyValueRow = memo(function KeyValueRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: (text: string) => void;
}) {
  const displayValue = value || '(なし)';
  const isEmpty = !value;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        py: 0.5,
        alignItems: 'flex-start',
        '&:hover .copy-btn': { opacity: 1 },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          minWidth: 80,
          flexShrink: 0,
          color: 'text.secondary',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          flex: 1,
          wordBreak: 'break-all',
          color: isEmpty ? 'text.disabled' : 'text.primary',
        }}
      >
        {displayValue}
      </Typography>
      {onCopy && value && (
        <IconButton
          size="small"
          className="copy-btn"
          onClick={() => onCopy(value)}
          sx={{
            opacity: 0,
            transition: 'opacity 0.2s',
            p: 0.25,
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  );
});

// 編集用インライン入力コンポーネント（TextField + composition対応）
const InlineInput = memo(function InlineInput({
  initialValue,
  onConfirm,
  onCancel,
  placeholder,
}: {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  placeholder: string;
}) {
  const [value, setValue] = useState(initialValue);
  const isComposingRef = useRef(false);
  const hasConfirmedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCompositionEndRef = useRef<number>(0);

  // autoFocusが効かない場合があるので、useEffectでフォーカスを当てる
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME変換中は完全に無視
    if (isComposingRef.current) {
      return;
    }

    // IME変換直後のEnter（確定のEnter）は無視
    // Chrome等では compositionEnd と Enter が同時に来ることがある
    if (e.key === 'Enter') {
      const now = Date.now();
      if (now - lastCompositionEndRef.current < 50) {
        // 変換確定直後のEnterは無視（変換確定と同時に発火するため）
        return;
      }
      e.preventDefault();
      hasConfirmedRef.current = true;
      onConfirm(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    lastCompositionEndRef.current = Date.now();
    // compositionEndで最終値を取得
    setValue(e.currentTarget.value);
  };

  const handleBlur = () => {
    // 既に確定済みならキャンセルしない
    if (hasConfirmedRef.current) return;
    // IME変換中はキャンセルしない
    if (isComposingRef.current) return;
    // 少し待ってからキャンセル（IME変換完了直後のブラー対策）
    setTimeout(() => {
      if (!hasConfirmedRef.current && !isComposingRef.current) {
        onCancel();
      }
    }, 100);
  };

  return (
    <TextField
      inputRef={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => { isComposingRef.current = true; }}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      autoFocus
      size="small"
      variant="outlined"
      inputProps={{
        lang: 'ja',
        style: {
          padding: '4px 8px',
          fontSize: 'inherit',
        },
      }}
      sx={{
        minWidth: 80,
        position: 'relative',
        zIndex: 10,
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: 'primary.main',
          },
        },
      }}
    />
  );
});

// 郵便番号から引いた住所候補の型
interface PostalCandidate {
  prefecture: string;
  city: string;
  town: string;
}

export function LabelPreview({ row, draft, hasDraft, onClose, onDraftUpdate, onRevertDraft }: LabelPreviewProps) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [postalCandidates, setPostalCandidates] = useState<PostalCandidate[]>([]);
  const [confirmCandidate, setConfirmCandidate] = useState<PostalCandidate | null>(null);
  const [customerConfirmDialogOpen, setCustomerConfirmDialogOpen] = useState(false);
  const [customerConfirmReason, setCustomerConfirmReason] = useState(row.customerConfirmReason || '');
  const [postalDebugInfo, setPostalDebugInfo] = useState<PostalLookupResult['debugInfo'] | null>(null);

  // 既に顧客確認フラグがあるか
  const hasCustomerConfirmFlag = row.flags?.split('|').some(f => CUSTOMER_CONFIRM_FLAGS.includes(f as never));

  // POSTAL_MISMATCHの場合、郵便番号から住所候補を取得
  const hasPostalMismatch = row.flags?.includes('POSTAL_MISMATCH');

  useEffect(() => {
    if (hasPostalMismatch && row.postal_code) {
      lookupPostalCode(row.postal_code).then((candidates) => {
        setPostalCandidates(candidates);
      });

      // デバッグ情報も取得
      const result = verifyPostalCode(
        row.postal_code,
        row.prefecture || '',
        row.city || '',
        row.town || ''
      );
      setPostalDebugInfo(result.debugInfo || null);
    } else {
      setPostalCandidates([]);
      setPostalDebugInfo(null);
    }
  }, [hasPostalMismatch, row.postal_code, row.prefecture, row.city, row.town]);

  // 現在の住所（ドラフト優先）と郵便番号候補が一致しているかチェック
  const isAddressAlreadyMatched = useMemo(() => {
    if (postalCandidates.length === 0) return false;
    const currentPref = draft?.prefecture ?? row.prefecture;
    const currentCity = draft?.city ?? row.city;
    const currentTown = draft?.town ?? row.town;

    return postalCandidates.some(c =>
      c.prefecture === currentPref &&
      c.city === currentCity &&
      (!c.town || !currentTown || c.town.startsWith(currentTown) || currentTown.startsWith(c.town))
    );
  }, [postalCandidates, row.prefecture, row.city, row.town, draft]);

  // 郵便番号候補の住所を適用（郵便番号側を正とする）
  const handleApplyPostalCandidate = useCallback((candidate: PostalCandidate) => {
    onDraftUpdate({
      prefecture: candidate.prefecture,
      city: candidate.city,
      town: candidate.town,
    });
    setConfirmCandidate(null);
  }, [onDraftUpdate]);

  // 住所を正として郵便番号を空欄にする
  const handleClearPostalCode = useCallback(() => {
    onDraftUpdate({
      postal_code: '',
    });
  }, [onDraftUpdate]);

  // クリップボードにコピー
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // フォールバック（古いブラウザ用）
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }, []);

  // 常に編集可能（フラグの有無に関わらず）
  const editable = true;

  // ローマ字市区町村を検出（例：ZUSHI-SHI, YOKOHAMA-SHI など）
  const hasRomanjiCity = useCallback((): boolean => {
    if (!row.city) return false;
    // 大文字アルファベットとハイフンのみで構成されているか
    return /^[A-Z][A-Z\-\s]+$/.test(row.city.trim());
  }, [row.city]);

  // ローマ字市区町村検出時は自動でcityを編集状態にする
  useEffect(() => {
    if (hasRomanjiCity() && !editingField) {
      // 少し遅延させてマウント後に実行
      const timer = setTimeout(() => {
        setEditingField('city');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasRomanjiCity, editingField]);

  // 郵便番号フォーマット（7桁 → xxx-xxxx）
  const formatPostalCode = (code: string): string => {
    if (!code || code.length !== 7) return code;
    return `${code.slice(0, 3)}-${code.slice(3)}`;
  };

  // 編集開始
  const handleStartEdit = useCallback((field: EditableField) => {
    if (!editable) return;
    setEditingField(field);
  }, [editable]);

  // 編集確定（値を引数で受け取る）
  const handleConfirm = useCallback((value: string) => {
    if (!editingField) return;
    const field = editingField;
    setEditingField(null);
    onDraftUpdate({ [field]: value });
  }, [editingField, onDraftUpdate]);

  // 編集キャンセル
  const handleCancel = useCallback(() => {
    setEditingField(null);
  }, []);

  // フィールドの値を取得（ドラフト優先）
  const getFieldValue = (field: EditableField): string => {
    // ドラフトに値があればそれを使う
    const draftValue = draft?.[field];
    if (draftValue !== undefined) {
      if (field === 'postal_code') {
        return formatPostalCode(draftValue);
      }
      return draftValue;
    }
    // 元の値
    if (field === 'postal_code') {
      return formatPostalCode(row.postal_code);
    }
    return row[field] || '';
  };

  // フィールドがドラフトで変更されているか
  const isFieldModified = (field: EditableField): boolean => {
    return draft?.[field] !== undefined;
  };

  // オプショナルなフィールド（空欄でもOK）
  const optionalFields: EditableField[] = ['building', 'room', 'town'];

  // 編集可能なスパンをレンダリング
  const renderEditableSpan = (field: EditableField, placeholder: string) => {
    const value = getFieldValue(field);
    const isEditing = editingField === field;
    const modified = isFieldModified(field);
    const isOptional = optionalFields.includes(field);

    if (isEditing) {
      return (
        <InlineInput
          key={field}
          initialValue={value}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          placeholder={placeholder}
        />
      );
    }

    if (!editable) {
      return <span key={field}>{value}</span>;
    }

    // 空欄の色：オプショナルならグレー、必須なら赤
    const emptyColor = isOptional ? 'text.disabled' : 'error.main';
    const emptyBorderColor = isOptional ? 'grey.400' : 'error.main';

    return (
      <Tooltip key={field} title="クリックで編集" placement="top" disableInteractive>
        <Box
          component="span"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleStartEdit(field);
          }}
          sx={{
            cursor: 'pointer',
            borderBottom: '1px dashed',
            borderColor: modified ? 'info.main' : value ? 'primary.main' : emptyBorderColor,
            backgroundColor: modified ? 'info.100' : 'transparent',
            '&:hover': {
              backgroundColor: modified ? 'info.200' : 'action.hover',
            },
            display: 'inline',
            minWidth: value ? 'auto' : 60,
            color: modified ? 'info.dark' : value ? 'inherit' : emptyColor,
            fontWeight: modified ? 'bold' : 'normal',
            px: modified ? 0.5 : 0,
            borderRadius: modified ? 0.5 : 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {value || placeholder}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        backgroundColor: '#fff',
        border: '2px solid #333',
        borderRadius: 1,
        position: 'relative',
        minWidth: 300,
        maxWidth: 400,
      }}
    >
      <IconButton
        size="small"
        onClick={onClose}
        sx={{ position: 'absolute', top: 4, right: 4 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          ラベルプレビュー
        </Typography>
        {editable && (
          <EditIcon fontSize="small" color="primary" sx={{ opacity: 0.6 }} />
        )}
        {hasDraft && (
          <Chip
            label="未保存"
            size="small"
            color="info"
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        )}
      </Box>

      {/* 郵便番号 */}
      <Typography
        variant="h6"
        sx={{ fontFamily: 'monospace', mb: 1 }}
      >
        〒{renderEditableSpan('postal_code', '000-0000')}
      </Typography>

      {/* 住所1行目：都道府県 + 市区町村 + 町域 + 番地 */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 'bold',
          lineHeight: 1.6,
          wordBreak: 'break-all',
        }}
      >
        {renderEditableSpan('prefecture', '都道府県')}
        {renderEditableSpan('city', '市区町村')}
        {renderEditableSpan('town', '')}
        {renderEditableSpan('number_block', '番地')}
      </Typography>

      {/* 住所2行目：建物 + 部屋 */}
      <Typography
        variant="h6"
        sx={{
          mt: 0.5,
          lineHeight: 1.6,
          wordBreak: 'break-all',
        }}
      >
        {renderEditableSpan('building', '建物名')}
        {' '}
        {renderEditableSpan('room', '部屋番号')}
      </Typography>

      {/* フラグ警告 */}
      {row.flags && (
        <Box sx={{ mt: 2, pt: 1, borderTop: '1px dashed #ccc' }}>
          <Typography variant="caption" color="warning.main">
            {row.suggestion}
          </Typography>
        </Box>
      )}

      {/* 郵便番号ミスマッチ時の2択UI */}
      {hasPostalMismatch && postalCandidates.length > 0 && (
        <Alert
          severity={isAddressAlreadyMatched ? 'success' : 'warning'}
          icon={isAddressAlreadyMatched ? <CheckCircleOutlineIcon fontSize="small" /> : <WarningAmberIcon fontSize="small" />}
          sx={{
            mt: 1.5,
            py: 1,
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          {isAddressAlreadyMatched ? (
            <>
              <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                住所と郵便番号が一致しています
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                「変更を保存」でこのフラグは自動的に解消されます
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                郵便番号と住所が一致しません。どちらを正としますか？
              </Typography>

              {/* デバッグ情報: どこがズレているか表示 */}
              {postalDebugInfo && (
                <Box sx={{
                  mb: 1.5,
                  p: 1,
                  backgroundColor: 'grey.100',
                  borderRadius: 0.5,
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                }}>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
                    📍 postal_key: {postalDebugInfo.postalKey || '(空)'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
                    📝 input_key: {postalDebugInfo.inputKey || '(空)'}
                  </Typography>
                  {postalDebugInfo.matchDetails && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem', mt: 0.5 }}>
                      pref: {postalDebugInfo.matchDetails.prefMatch ? '✓' : '✗'} |
                      city: {postalDebugInfo.matchDetails.cityMatch ? '✓' : '✗'} |
                      town: {postalDebugInfo.matchDetails.townMatch ? '✓' : '✗'}
                    </Typography>
                  )}
                </Box>
              )}

              {/* 選択肢1: 郵便番号側を正とする */}
              <Box
                sx={{
                  p: 1.5,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'primary.light',
                  borderRadius: 1,
                  backgroundColor: 'primary.50',
                }}
              >
                <Typography variant="caption" fontWeight="bold" color="primary.main" sx={{ display: 'block', mb: 0.5 }}>
                  ① 郵便番号を正とする（住所を修正）
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  〒{row.postal_code} の登録住所:
                </Typography>
                {postalCandidates.length === 1 ? (
                  // 候補が1件のみの場合
                  <>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                      {postalCandidates[0].prefecture} {postalCandidates[0].city} {postalCandidates[0].town}
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => setConfirmCandidate(postalCandidates[0])}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      この住所に修正
                    </Button>
                  </>
                ) : (
                  // 候補が複数の場合（町域選択）
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {postalCandidates.slice(0, 5).map((candidate, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          p: 0.75,
                          backgroundColor: 'background.paper',
                          borderRadius: 0.5,
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Typography variant="caption" sx={{ flex: 1 }}>
                          {candidate.prefecture} {candidate.city} {candidate.town || '（町域不明）'}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => setConfirmCandidate(candidate)}
                          sx={{ fontSize: '0.65rem', py: 0.25, minWidth: 50 }}
                        >
                          選択
                        </Button>
                      </Box>
                    ))}
                    {postalCandidates.length > 5 && (
                      <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
                        他{postalCandidates.length - 5}件の候補があります
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* 選択肢2: 住所側を正とする */}
              <Box
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  backgroundColor: 'grey.50',
                }}
              >
                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  ② 住所を正とする
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  現在: {row.prefecture || '(なし)'} {row.city || '(なし)'} {row.town || ''}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={handleClearPostalCode}
                    sx={{ fontSize: '0.7rem' }}
                  >
                    郵便番号を空欄にする
                  </Button>
                  <Tooltip title="住所はこのままで、郵便番号も維持し顧客確認へ移動">
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      onClick={() => {
                        setCustomerConfirmReason('郵便番号と住所が一致しません。正しい住所をご確認ください。');
                        setCustomerConfirmDialogOpen(true);
                      }}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      顧客に確認する
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
            </>
          )}
        </Alert>
      )}

      {/* 確認ダイアログ */}
      <Dialog
        open={!!confirmCandidate}
        onClose={() => setConfirmCandidate(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          住所を変更しますか？
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            都道府県・市区町村・町域を以下に変更します：
          </Typography>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="body2" sx={{ minWidth: 60, color: 'text.secondary' }}>
                変更前
              </Typography>
              <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'error.main' }}>
                {row.prefecture || '(なし)'} {row.city || '(なし)'} {row.town || ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 60, color: 'text.secondary' }}>
                変更後
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {confirmCandidate?.prefecture} {confirmCandidate?.city} {confirmCandidate?.town}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmCandidate(null)} color="inherit">
            キャンセル
          </Button>
          <Button
            onClick={() => confirmCandidate && handleApplyPostalCandidate(confirmCandidate)}
            variant="contained"
            color="primary"
          >
            変更する
          </Button>
        </DialogActions>
      </Dialog>

      {/* 顧客確認ダイアログ */}
      <Dialog
        open={customerConfirmDialogOpen}
        onClose={() => setCustomerConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          顧客確認に移動
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            この住所は顧客に直接確認が必要なものとしてマークします。
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="確認理由（任意）"
            placeholder="例: 番地が不明確、建物名が読み取れない等"
            value={customerConfirmReason}
            onChange={(e) => setCustomerConfirmReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCustomerConfirmDialogOpen(false)} color="inherit">
            キャンセル
          </Button>
          <Button
            onClick={() => {
              // フラグにNEED_CUSTOMER_CONFIRMを追加し、理由を保存
              const currentFlags = row.flags ? row.flags.split('|').filter(Boolean) : [];
              if (!currentFlags.includes('NEED_CUSTOMER_CONFIRM')) {
                currentFlags.push('NEED_CUSTOMER_CONFIRM');
              }
              // フラグはOutputRowの直接変更ではなく、特殊な方法で扱う必要がある
              // customerConfirmReasonをドラフトに保存
              onDraftUpdate({ customerConfirmReason });
              setCustomerConfirmDialogOpen(false);
            }}
            variant="contained"
            color="info"
            startIcon={<ContactMailIcon />}
          >
            顧客確認に移動
          </Button>
        </DialogActions>
      </Dialog>

      {/* 顧客確認に移動ボタン（フラグがない場合のみ表示） */}
      {!hasCustomerConfirmFlag && row.flags && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            color="info"
            startIcon={<ContactMailIcon />}
            onClick={() => setCustomerConfirmDialogOpen(true)}
            sx={{ fontSize: '0.75rem' }}
          >
            顧客確認に移動
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}
          >
            ツールで解決できない場合、顧客への連絡用リストに移動します
          </Typography>
        </Box>
      )}

      {/* 顧客確認理由の表示（既にフラグがある場合） */}
      {hasCustomerConfirmFlag && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          <Typography variant="caption" fontWeight="bold" sx={{ display: 'block' }}>
            顧客確認が必要
          </Typography>
          {(draft?.customerConfirmReason || row.customerConfirmReason) && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              理由: {draft?.customerConfirmReason || row.customerConfirmReason}
            </Typography>
          )}
        </Alert>
      )}

      {/* 電話番号混入検出 */}
      {row._detectedPhone && row.flags?.includes('PHONE_IN_NUMBER_BLOCK') && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          <Typography variant="caption" fontWeight="bold" sx={{ display: 'block' }}>
            📞 番地に電話番号が混入しています
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            検出: {row._detectedPhone}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.65rem' }}>
            ※ 電話番号列が空の場合は自動的に移動されます
          </Typography>
        </Alert>
      )}

      {/* 英語建物名許容ボタン */}
      {canAcceptEnglishBuilding(row) && (
        <Box sx={{ mt: 1.5 }}>
          <Box
            onClick={() => {
              // 英語建物名許容はflagsを変更するがOutputRowのフィールドではないため
              // 特別扱いは不要（保存時にrevalidateFlagsで再計算される）
              // ここでは直接フラグ変更せず、buildingフィールドへのダミー変更としてマーク
              // 実際には保存時にフラグが再計算されるのでそのまま使える
              onDraftUpdate({ building: row.building || '' });
            }}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'success.main',
              color: 'success.main',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: 'success.light',
                color: 'success.contrastText',
              },
              transition: 'all 0.2s',
            }}
          >
            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
            このまま使用する（英語建物名を許容）
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}
          >
            建物名の英語表記をそのまま使用します
          </Typography>
        </Box>
      )}

      {/* 編集ヒント＆元に戻すボタン */}
      {editable && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            下線部分をクリックして編集（Enter確定 / Escキャンセル）
          </Typography>
          {hasDraft && (
            <Button
              size="small"
              color="inherit"
              startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
              onClick={onRevertDraft}
              sx={{ fontSize: '0.7rem', py: 0.25 }}
            >
              元に戻す
            </Button>
          )}
        </Box>
      )}

      {/* 詳細セクション（折りたたみ） */}
      <Box sx={{ mt: 2 }}>
        <Divider />
        <Box
          onClick={() => setDetailsExpanded(!detailsExpanded)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            py: 1,
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'action.hover' },
            borderRadius: 1,
          }}
        >
          <ExpandMoreIcon
            sx={{
              fontSize: 18,
              transform: detailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            詳細（この行の全情報）
          </Typography>
        </Box>

        <Collapse in={detailsExpanded}>
          <Box
            sx={{
              maxHeight: 300,
              overflowY: 'auto',
              pl: 1,
              pr: 0.5,
            }}
          >
            {/* 元CSVの列 */}
            {row._originalColumns && Object.keys(row._originalColumns).length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 'bold', color: 'primary.main', display: 'block', mb: 0.5 }}
                >
                  元CSV
                </Typography>
                {Object.entries(row._originalColumns).map(([key, value]) => (
                  <KeyValueRow
                    key={`orig_${key}`}
                    label={key}
                    value={value}
                    onCopy={handleCopy}
                  />
                ))}
              </Box>
            )}

            {/* 解析結果 */}
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 'bold', color: 'primary.main', display: 'block', mb: 0.5 }}
              >
                解析結果
              </Typography>
              {RESULT_FIELD_ORDER.map((fieldKey) => {
                let value = row[fieldKey as keyof OutputRow];
                // confidenceは%表示
                if (fieldKey === 'confidence' && typeof value === 'number') {
                  value = `${Math.round(value * 100)}%`;
                }
                return (
                  <KeyValueRow
                    key={fieldKey}
                    label={RESULT_FIELD_LABELS[fieldKey] || fieldKey}
                    value={String(value ?? '')}
                    onCopy={handleCopy}
                  />
                );
              })}
            </Box>
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
}
