import { useEffect, useState } from 'react';
import { FilterBar } from '@renderer/components/FilterBar';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import type { PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from './ProductDetailDrawer';

export function ProductsPage() {
  const filters = useFilterStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<ProductTableItem[]>([]);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);
  useEffect(() => {
    window.ecomApi.analytics.getProducts(filters).then(setData);
  }, [filters.periodLabel, filters.keyword]);

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setOpen(true);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} />
      <ProductDataTable data={data} onRowClick={handleRowClick} />
      <ProductDetailDrawer open={open} detail={detail} onClose={() => setOpen(false)} />
    </div>
  );
}
