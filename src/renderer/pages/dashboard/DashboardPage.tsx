import { Alert, Button, Col, Row, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { CustomAnalysisCard } from '@renderer/components/CustomAnalysisCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import type { DashboardPayload, PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from '../products/ProductDetailDrawer';

type LinkMode = 'all' | 'ranking' | 'quadrant';

export function DashboardPage() {
  const filters = useFilterStore();
  const { setLinkedProducts: setGlobalLinkedProducts, clearLinkedProducts: clearGlobalLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [products, setProducts] = useState<ProductTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkMode, setLinkMode] = useState<LinkMode>('all');
  const [linkedCodes, setLinkedCodes] = useState<string[]>([]);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.ecomApi.analytics.getDashboard(filters),
      window.ecomApi.analytics.getProducts(filters)
    ]).then(([dashboard, productRows]) => {
      setData(dashboard);
      setProducts(productRows);
      setLoading(false);
    });
  }, [filters.periodLabel, filters.keyword, filters.periodType]);

  const linkedProducts = useMemo(() => {
    if (linkMode === 'all' || !linkedCodes.length) return products;
    return products.filter((item) => linkedCodes.includes(item.productCodeNorm));
  }, [linkMode, linkedCodes, products]);

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: data?.trend.map((item) => item.periodLabel) ?? [] },
    yAxis: [{ type: 'value' }, { type: 'value' }],
    series: [
      { name: '支付金额', type: 'line', smooth: true, data: data?.trend.map((item) => item.payAmount) ?? [] },
      { name: '广告花费', type: 'line', smooth: true, data: data?.trend.map((item) => item.adCost) ?? [] },
      { name: '总成交金额', type: 'bar', yAxisIndex: 1, data: data?.trend.map((item) => item.totalGmv) ?? [] }
    ]
  };

  const rankingOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: data?.ranking.map((item) => item.productName) ?? [] },
    series: [{ type: 'bar', data: data?.ranking.map((item) => item.payAmount) ?? [], itemStyle: { color: '#1677ff' } }]
  };

  const quadrantOption = {
    tooltip: { trigger: 'item' },
    xAxis: { name: '花费' },
    yAxis: { name: '支付金额' },
    visualMap: {
      dimension: 3,
      min: 0,
      max: Math.max(...(data?.quadrant.map((item) => item.roi) ?? [1])),
      right: 12,
      top: 12
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(18, Number(val[2] || 0)),
        data: data?.quadrant.map((item) => [item.spend, item.payAmount, item.bubbleSize, item.roi, item.productName, item.productCodeNorm]) ?? []
      }
    ]
  };

  const handleRankingClick = (params: unknown) => {
    const chartParams = params as { dataIndex?: number };
    const row = data?.ranking[chartParams.dataIndex ?? -1];
    if (!row) return;
    setLinkMode('ranking');
    setLinkedCodes([row.productCodeNorm]);
    setGlobalLinkedProducts([row.productCodeNorm], `经营总览 / Top 商品排行 / ${row.productName}`);
  };

  const handleQuadrantClick = (params: unknown) => {
    const chartParams = params as { data?: unknown[] };
    const productCodeNorm = String(chartParams.data?.[5] ?? '');
    if (!productCodeNorm) return;
    setLinkMode('quadrant');
    setLinkedCodes([productCodeNorm]);
    setGlobalLinkedProducts([productCodeNorm], '经营总览 / 投入产出散点图');
  };

  const resetLinkedProducts = () => {
    setLinkMode('all');
    setLinkedCodes([]);
    clearGlobalLinkedProducts();
  };

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setDetailOpen(true);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} />
      <Row gutter={[16, 16]}>
        <Col span={6}><KPIStatCard title="支付总金额" value={data?.metrics.totalPayAmount ?? 0} /></Col>
        <Col span={6}><KPIStatCard title="广告花费" value={data?.metrics.totalAdCost ?? 0} /></Col>
        <Col span={6}><KPIStatCard title="ROI" value={data?.metrics.roi ?? 0} /></Col>
        <Col span={6}><KPIStatCard title="总退款率" value={(data?.metrics.totalRefundRate ?? 0) * 100} suffix="%" /></Col>
        <Col span={8}><KPIStatCard title="发货前退款率" value={(data?.metrics.refundPreRate ?? 0) * 100} suffix="%" /></Col>
        <Col span={8}><KPIStatCard title="发货后退款率" value={(data?.metrics.refundPostRate ?? 0) * 100} suffix="%" /></Col>
        <Col span={8}><KPIStatCard title="售后退款率" value={(data?.metrics.refundAftersaleRate ?? 0) * 100} suffix="%" /></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col span={24}><BaseChartCard title="流量 / 花费 / 成交趋势" loading={loading} option={trendOption} /></Col>
        <Col span={10}>
          <BaseChartCard
            title="Top 商品排行"
            loading={loading}
            option={rankingOption}
            onEvents={{ click: handleRankingClick }}
          />
        </Col>
        <Col span={14}>
          <BaseChartCard
            title="投入产出散点图"
            loading={loading}
            option={quadrantOption}
            onEvents={{ click: handleQuadrantClick }}
          />
        </Col>
      </Row>

      <CustomAnalysisCard data={data} loading={loading} />

      <div className="page-stack">
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>图表联动商品池</Typography.Title>
          <Space>
            {linkMode !== 'all' ? <Alert type="info" showIcon message={`当前已按${linkMode === 'ranking' ? '商品排行' : '投入产出散点'}联动筛选`} /> : null}
            <Button onClick={resetLinkedProducts} disabled={linkMode === 'all'}>清除联动</Button>
          </Space>
        </Space>
        <ProductDataTable data={linkedProducts} onRowClick={handleRowClick} />
      </div>

      <ProductDetailDrawer open={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
