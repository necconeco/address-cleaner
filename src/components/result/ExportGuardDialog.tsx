'use client';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { ExportAction } from './ExportButtons';

interface ExportGuardDialogProps {
  open: boolean;
  action: ExportAction | null;
  draftCount: number;
  onClose: () => void;
  onSaveAndExport: () => void;
  onDiscardAndExport: () => void;
}

export function ExportGuardDialog({
  open,
  draftCount,
  onClose,
  onSaveAndExport,
  onDiscardAndExport,
}: ExportGuardDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>未保存の変更があります</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {draftCount}件の未保存の変更があります。どうしますか？
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button onClick={onDiscardAndExport} color="warning">
          破棄して出力
        </Button>
        <Button onClick={onSaveAndExport} variant="contained" color="primary">
          保存して出力
        </Button>
      </DialogActions>
    </Dialog>
  );
}
