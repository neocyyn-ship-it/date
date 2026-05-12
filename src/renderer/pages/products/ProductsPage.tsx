import { Alert, Button, Col, Row, Select, Space, Statistic, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '@renderer/components/FilterBar';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import { exportProductRowsToCsv } from '@renderer/utils/exportProductRows';
import { DEFAULT_PRODUCT_COLUMNS, PRODUCT_COLUMN_OPTIONS, type ProductColumnKey } from '@renderer/utils/productColumns';
import { applyProductFilters } from '@renderer/utils/productFilters';
import type { PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from './ProductDetailDrawer';

function sumBy(items: ProductTableItem[], selector: (item: ProductTableItem) => number) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

export function ProductsPage() {
  const filters = useFilterStore();
  const { linkedProductCodes, sourceLabel, clearLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [sourceSheets, setSourceSheets] = useState<string[]>([]);
  const [data, setData] = useState<ProductTableItem[]>([]);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ProductColumnKey[]>(DEFAULT_PRODUCT_COLUMNS);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => {
      setPeriods(result.periods);
      setSourceSheets(result.sourceSheets);
    });
  }, []);

  useEffect(() => {
    window.ecomApi.analytics.getProducts(filters).then(setData);
  }, [filters.periodLabel, filters.keyword, filters.periodType, filters.sourceSheet]);

  const filteredData = useMemo(() => applyProductFilters(data, filters), [data, filters]);

  const displayData = useMemo(() => {
    if (!linkedProductCodes.length) {
      return filteredData;
    }
    return filteredData.filter((item) => linkedProductCodes.includes(item.productCodeNorm));
  }, [filteredData, linkedProductCodes]);

  const summary = useMemo(() => {
    return {
      count: displayData.length,
      payAmount: sumBy(displayData, (item) => item.payAmount),
      adCost: sumBy(displayData, (item) => item.adCost),
      naturalCount: displayData.filter((item) => item.tags.includes('自然流强')).length,
      adsCount: displayData.filter((item) => item.tags.includes('广告驱动')).length,
      highSpendCount: displayData.filter((item) => item.tags.includes('高消耗低产出')).length
    };
  }, [displayData]);

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setOpen(true);
  };

  const handleExport = () => {
    if (!displayData.length) {
      message.warning('当前没有可导出的商品结果。');
      return;
    }

    const periodLabel = filters.periodLabel || '全部周期';
    const sourceSheet = filters.sourceSheet || '全部源sheet';
    exportProductRowsToCsv(displayData, `商品分析-${periodLabel}-${sourceSheet}.csv`, visibleColumns);
    message.success(`已按当前列配置导出 ${displayData.length} 条商品结果。`);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} sourceSheets={sourceSheets} />

      <Alert
        type="success"
        showIcon
        message={`当前分析范围：${filters.sourceSheet || '全部源 sheet'}`}
        description={`当前商品池命中 ${summary.count} 个商品，支付合计 ${summary.payAmount.toFixed(2)}，阿里妈妈花费合计 ${summary.adCost.toFixed(
          2
        )}。顶部筛选会直接作用于当前商品池，导出也会跟着当前列配置一起走。`}
      />

      <Space style={{ justifyContent: 'space-between', width: '100%' }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>
          商品分析
        </Typography.Title>
        <Space>
          <Select
            mode="multiple"
            style={{ width: 420 }}
            value={visibleColumns}
            options={PRODUCT_COLUMN_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
            onChange={(value) => setVisibleColumns(value as ProductColumnKey[])}
            maxTagCount="responsive"
            placeholder="选择展示列"
          />
          <Button onClick={() => setVisibleColumns(DEFAULT_PRODUCT_COLUMNS)}>恢复默认列</Button>
          <Button onClick={handleExport}>按当前列导出</Button>
          {linkedProductCodes.length ? <Button onClick={clearLinkedProducts}>清除跨页联动</Button> : null}
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        message="当前商品分析口径"
        description="支付看生参支付金额，投产看阿里妈妈花费和投产比。广告成交占比越高，越偏广告驱动。你现在可以自由切展示列，并按当前列配置导出结果。"
      />

      {linkedProductCodes.length ? (
        <Alert type="info" showIcon message={`当前正在查看跨页联动商品池：${sourceLabel || '图表联动'}`} />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col span={4}>
          <Statistic title="当前商品数" value={summary.count} />
        </Col>
        <Col span={5}>
          <Statistic title="生参支付金额合计" value={summary.payAmount} precision={2} />
        </Col>
        <Col span={5}>
          <Statistic title="阿里妈妈花费合计" value={summary.adCost} precision={2} />
        </Col>
        <Col span={3}>
          <Statistic title="自然流强" value={summary.naturalCount} />
        </Col>
        <Col span={3}>
          <Statistic title="广告驱动" value={summary.adsCount} />
        </Col>
        <Col span={4}>
          <Statistic title="高消耗低产出" value={summary.highSpendCount} />
        </Col>
      </Row>

      <ProductDataTable data={displayData} visibleColumns={visibleColumns} onRowClick={handleRowClick} />
      <ProductDetailDrawer open={open} detail={detail} onClose={() => setOpen(false)} />
    </div>
  );
}
