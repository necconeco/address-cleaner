'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>使い方ガイド</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          クイックスタート
        </Typography>

        <List dense>
          <ListItem>
            <ListItemIcon>
              <CloudUploadIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="1. CSVをアップロード"
              secondary="UTF-8形式のCSVファイルを選択し、住所列を指定します"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TableChartIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="2. 処理実行"
              secondary="住所を正規化・分解し、ラベル用の形式に変換します"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <FilterListIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="3. 要確認を確認"
              secondary="フラグが付いた行を確認し、必要に応じて手動修正します"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <DownloadIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="4. CSVダウンロード"
              secondary="全件または要確認のみをダウンロードできます"
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          対応形式
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>Google Maps形式</strong>: カンマ区切り、Japan/Prefecture含む
          <br />
          例: 2-11-9, #319, Bunkyo-ku, Tokyo, 112-0011, Japan
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>日本語形式</strong>: 都道府県から始まる日本語住所
          <br />
          例: 東京都江戸川区篠崎町4-28-16 栞101
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <LockIcon fontSize="small" />
          データはブラウザ内で処理され、サーバーには送信されません
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
