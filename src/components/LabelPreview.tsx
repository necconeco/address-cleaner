'use client';

import { Box, Paper, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { OutputRow } from '@/types';

interface LabelPreviewProps {
  row: OutputRow | null;
  onClose: () => void;
}

export function LabelPreview({ row, onClose }: LabelPreviewProps) {
  if (!row) return null;

  // 郵便番号フォーマット（7桁 → xxx-xxxx）
  const formatPostalCode = (code: string): string => {
    if (!code || code.length !== 7) return code;
    return `${code.slice(0, 3)}-${code.slice(3)}`;
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

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1, display: 'block' }}
      >
        ラベルプレビュー
      </Typography>

      {/* 郵便番号 */}
      {row.postal_code && (
        <Typography
          variant="h6"
          sx={{ fontFamily: 'monospace', mb: 1 }}
        >
          〒{formatPostalCode(row.postal_code)}
        </Typography>
      )}

      {/* 住所1行目 */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 'bold',
          lineHeight: 1.4,
          wordBreak: 'break-all',
        }}
      >
        {row.label_line1 || '（住所1行目なし）'}
      </Typography>

      {/* 住所2行目 */}
      {row.label_line2 && (
        <Typography
          variant="h6"
          sx={{
            mt: 0.5,
            lineHeight: 1.4,
            wordBreak: 'break-all',
          }}
        >
          {row.label_line2}
        </Typography>
      )}

      {/* フラグ警告 */}
      {row.flags && (
        <Box sx={{ mt: 2, pt: 1, borderTop: '1px dashed #ccc' }}>
          <Typography variant="caption" color="warning.main">
            {row.suggestion}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
