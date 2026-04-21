import { Alert, Button, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '@renderer/components/FilterBar';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import type { PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from './ProductDetailDrawer';

export function ProductsPage() {
  const filters = useFilterStore();
  const { linkedProductCodes, sourceLabel, clearLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<ProductTableItem[]>([]);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);
  useEffect(() => {
    window.ecomApi.analytics.getProducts(filters).then(setData);
  }, [filters.periodLabel, filters.keyword, filters.periodType]);

  const displayData = useMemo(() => {
    if (!linkedProductCodes.length) return data;
    return data.filter((item) => linkedProductCodes.includes(item.productCodeNorm));
  }, [data, linkedProductCodes]);

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setOpen(true);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} />
      {linkedProductCodes.length ? (
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={`当前正在查看跨页联动商品池：${sourceLabel || '图表联动'}`}
          />
          <Button onClick={clearLinkedProducts}>清除跨页联动</Button>
        </Space>
      ) : null}
      <ProductDataTable data={displayData} onRowClick={handleRowClick} />
      <ProductDetailDrawer open={open} detail={detail} onClose={() => setOpen(false)} />
    </div>
  );
}
