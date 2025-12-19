'use client';

import { Alert, Box, Button, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';

interface DraftBarProps {
  draftCount: number;
  onSave: () => void;
  onDiscard: () => void;
}

export function DraftBar({ draftCount, onSave, onDiscard }: DraftBarProps) {
  if (draftCount === 0) return null;

  return (
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
            onClick={onSave}
          >
            変更を保存（{draftCount}件）
          </Button>
          <Button
            color="inherit"
            size="small"
            startIcon={<UndoIcon />}
            onClick={onDiscard}
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
  );
}
