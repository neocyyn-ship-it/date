import { create } from 'zustand';
import type { FilterState } from '@shared/types';

interface FilterStore extends FilterState {
  setFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
  replaceFilters: (next: Partial<FilterState>) => void;
}

export const defaultFilterState: FilterState = {
  periodLabel: undefined,
  periodType: 'all',
  sourceSheet: undefined,
  focusTag: 'all',
  minPayAmount: undefined,
  minAdCost: undefined,
  minRefundRate: undefined,
  roiBucket: 'all',
  adShareBucket: 'all',
  imageMode: 'all',
  keyword: ''
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...defaultFilterState,
  setFilters: (patch) => set((state) => ({ ...state, ...patch })),
  resetFilters: () => set(() => ({ ...defaultFilterState })),
  replaceFilters: (next) => set(() => ({ ...defaultFilterState, ...next }))
}));
