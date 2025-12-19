'use client';

import { useState } from 'react';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EmailIcon from '@mui/icons-material/Email';
import CheckIcon from '@mui/icons-material/Check';
import { OutputRow } from '@/types';
import { generateConfirmationMessage, generateMailtoLink } from '@/lib/utils';

interface CustomerConfirmPanelProps {
  rows: OutputRow[];
  emailColumn: string | undefined;
  nameColumn: string | undefined;
}

export function CustomerConfirmPanel({ rows, emailColumn, nameColumn }: CustomerConfirmPanelProps) {
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

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
    const messages = rows.map(row => {
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

  if (rows.length === 0) return null;

  return (
    <Box sx={{
      mb: 2,
      p: 2,
      backgroundColor: 'info.50',
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'info.200',
    }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: 'info.dark' }}>
        顧客確認が必要な住所（{rows.length}件）
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
        {rows.map((row) => {
          const email = emailColumn && row._originalColumns?.[emailColumn];
          const name = nameColumn && row._originalColumns?.[nameColumn];
          const mailtoLink = generateMailtoLink(row, emailColumn, nameColumn);
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
  );
}
