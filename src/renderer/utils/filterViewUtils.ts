import type { FilterState } from '@shared/types';

export interface SavedFilterView {
  name: string;
  filters: Partial<FilterState>;
}

export const FILTER_VIEW_STORAGE_KEY = 'ecom-analytics-filter-views';

export function loadSavedFilterViews() {
  try {
    const raw = window.localStorage.getItem(FILTER_VIEW_STORAGE_KEY);
    if (!raw) {
      return [] as SavedFilterView[];
    }

    const parsed = JSON.parse(raw) as SavedFilterView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SavedFilterView[];
  }
}

export function persistSavedFilterViews(views: SavedFilterView[]) {
  window.localStorage.setItem(FILTER_VIEW_STORAGE_KEY, JSON.stringify(views));
}
