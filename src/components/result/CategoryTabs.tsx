'use client';

import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { CategoryType } from '@/types';
import { RowCategory } from '@/lib/utils';

interface CategoryTabsProps {
  category: CategoryType;
  counts: Record<RowCategory, number>;
  totalCount: number;
  onChange: (category: CategoryType) => void;
}

export function CategoryTabs({ category, counts, totalCount, onChange }: CategoryTabsProps) {
  return (
    <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
      <ToggleButtonGroup
        value={category}
        exclusive
        onChange={(_, value) => {
          if (value !== null) {
            onChange(value as CategoryType);
          }
        }}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            border: 'none',
            borderRadius: 0,
            borderBottom: '2px solid transparent',
            px: 2,
            py: 1,
            '&.Mui-selected': {
              backgroundColor: 'transparent',
              borderBottomColor: 'primary.main',
              color: 'primary.main',
              fontWeight: 'bold',
            },
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          },
        }}
      >
        <ToggleButton value="all">
          全件 ({totalCount})
        </ToggleButton>
        <ToggleButton value="empty" sx={{ color: counts.empty > 0 ? 'error.main' : 'inherit' }}>
          未入力 ({counts.empty})
        </ToggleButton>
        <ToggleButton value="needs_fix" sx={{ color: counts.needs_fix > 0 ? 'warning.main' : 'inherit' }}>
          要修正 ({counts.needs_fix})
        </ToggleButton>
        <ToggleButton value="ok" sx={{ color: counts.ok > 0 ? 'success.main' : 'inherit' }}>
          OK ({counts.ok})
        </ToggleButton>
        <ToggleButton value="customer_confirm" sx={{ color: counts.customer_confirm > 0 ? 'info.main' : 'inherit' }}>
          顧客確認 ({counts.customer_confirm})
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
