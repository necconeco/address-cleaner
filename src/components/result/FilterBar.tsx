'use client';

import { Box, Chip, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { FilterState, FormatType } from '@/types';
import { AddressFlag } from '@/types';
import { FLAG_LABELS, QUICK_FILTER_FLAGS } from '@/constants/flags';

interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

export function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  return (
    <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>形式</InputLabel>
        <Select
          value={filter.formatType}
          label="形式"
          onChange={(e) =>
            onFilterChange({
              ...filter,
              formatType: e.target.value as FormatType | 'all',
            })
          }
        >
          <MenuItem value="all">すべて</MenuItem>
          <MenuItem value="google_maps">Google Maps形式</MenuItem>
          <MenuItem value="japanese_full">日本語形式</MenuItem>
          <MenuItem value="unknown">不明</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {QUICK_FILTER_FLAGS.map((flag) => (
          <Chip
            key={flag}
            label={FLAG_LABELS[flag as AddressFlag]}
            variant={filter.quickFilter === flag ? 'filled' : 'outlined'}
            color={filter.quickFilter === flag ? 'primary' : 'default'}
            onClick={() =>
              onFilterChange({
                ...filter,
                quickFilter: filter.quickFilter === flag ? null : flag,
              })
            }
            size="small"
          />
        ))}
      </Box>
    </Box>
  );
}
