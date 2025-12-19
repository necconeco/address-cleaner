'use client';

import { Box, Button, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import { RowCategory } from '@/lib/utils';

export type ExportAction = 'all' | 'flagged' | 'yamato' | 'yamato_nekopos' | 'sagawa' | 'yupack' | 'customer_confirm';

interface ExportButtonsProps {
  categoryCounts: Record<RowCategory, number>;
  yamatoPostalWithHyphen: boolean;
  onYamatoPostalToggle: (checked: boolean) => void;
  onExport: (action: ExportAction) => void;
  onClear: () => void;
}

export function ExportButtons({
  categoryCounts,
  yamatoPostalWithHyphen,
  onYamatoPostalToggle,
  onExport,
  onClear,
}: ExportButtonsProps) {
  return (
    <Box sx={{ mt: 3 }}>
      {/* 標準出力 */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => onExport('all')}
        >
          CSV出力: 全件
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => onExport('flagged')}
        >
          CSV出力: 要確認のみ
        </Button>
        <Button
          variant="contained"
          color="info"
          startIcon={<ContactMailIcon />}
          onClick={() => onExport('customer_confirm')}
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
          onClick={() => onExport('yamato_nekopos')}
          disabled={categoryCounts.ok === 0}
        >
          ヤマトB2ネコポス ({categoryCounts.ok}件)
        </Button>
        {/* 佐川e飛伝Ⅲ */}
        <Button
          variant="contained"
          sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}
          startIcon={<LocalShippingIcon />}
          onClick={() => onExport('sagawa')}
          disabled={categoryCounts.ok === 0}
        >
          佐川e飛伝Ⅲ ({categoryCounts.ok}件)
        </Button>
        {/* ゆうパック */}
        <Button
          variant="contained"
          sx={{ backgroundColor: '#c62828', '&:hover': { backgroundColor: '#b71c1c' } }}
          startIcon={<LocalShippingIcon />}
          onClick={() => onExport('yupack')}
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
          onClick={() => onExport('yamato')}
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
                onChange={(e) => onYamatoPostalToggle(e.target.checked)}
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
  );
}
