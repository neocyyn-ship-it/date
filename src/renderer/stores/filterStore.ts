import { create } from 'zustand';
import type { FilterState } from '@shared/types';

interface FilterStore extends FilterState {
  setFilters: (patch: Partial<FilterState>) => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  periodLabel: undefined,
  periodType: 'all',
  keyword: '',
  setFilters: (patch) => set((state) => ({ ...state, ...patch }))
}));
