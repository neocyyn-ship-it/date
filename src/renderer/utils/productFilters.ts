import type { FilterState, ProductTableItem } from '@shared/types';

function matchesRoiBucket(roi: number, roiBucket: FilterState['roiBucket']) {
  if (!roiBucket || roiBucket === 'all') {
    return true;
  }

  if (roiBucket === 'lt1') {
    return roi < 1;
  }

  if (roiBucket === '1to2') {
    return roi >= 1 && roi < 2;
  }

  return roi >= 2;
}

function matchesAdShareBucket(adShare: number, adShareBucket: FilterState['adShareBucket']) {
  if (!adShareBucket || adShareBucket === 'all') {
    return true;
  }

  if (adShareBucket === 'lt30') {
    return adShare < 0.3;
  }

  if (adShareBucket === '30to60') {
    return adShare >= 0.3 && adShare < 0.6;
  }

  return adShare >= 0.6;
}

export function applyProductFilters(rows: ProductTableItem[], filters: FilterState) {
  return rows.filter((item) => {
    if (filters.focusTag && filters.focusTag !== 'all' && !item.tags.includes(filters.focusTag)) {
      return false;
    }

    if (filters.minPayAmount !== undefined && item.payAmount < filters.minPayAmount) {
      return false;
    }

    if (filters.minAdCost !== undefined && item.adCost < filters.minAdCost) {
      return false;
    }

    const refundRate = item.refundPreRate + item.refundPostRate + item.refundAftersaleRate;
    if (filters.minRefundRate !== undefined && refundRate < filters.minRefundRate) {
      return false;
    }

    if (!matchesRoiBucket(item.roi, filters.roiBucket)) {
      return false;
    }

    if (!matchesAdShareBucket(item.adAttributedShare, filters.adShareBucket)) {
      return false;
    }

    if (filters.imageMode === 'withImage' && !item.imagePath) {
      return false;
    }

    if (filters.imageMode === 'withoutImage' && item.imagePath) {
      return false;
    }

    return true;
  });
}
