'use client';

import { Box, Button, CircularProgress, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { ProcessingSummary } from '@/types';

interface SummaryPanelProps {
  summary: ProcessingSummary;
  completableCount: number;
  isCompleting: boolean;
  completionResult: string | null;
  onBatchComplete?: () => Promise<void>;
}

export function SummaryPanel({
  summary,
  completableCount,
  isCompleting,
  completionResult,
  onBatchComplete,
}: SummaryPanelProps) {
  return (
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
      {onBatchComplete && completableCount > 0 && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={isCompleting ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            onClick={onBatchComplete}
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
  );
}
