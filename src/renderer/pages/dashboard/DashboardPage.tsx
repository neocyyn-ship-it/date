import { Alert, Button, Card, Col, Empty, Row, Segmented, Select, Space, Statistic, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { CustomAnalysisCard } from '@renderer/components/CustomAnalysisCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { SavedViewBoard } from '@renderer/components/SavedViewBoard';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import { DEFAULT_PRODUCT_COLUMNS } from '@renderer/utils/productColumns';
import { exportProductRowsToCsv } from '@renderer/utils/exportProductRows';
import { applyProductFilters } from '@renderer/utils/productFilters';
import { loadSavedFilterViews, persistSavedFilterViews, type SavedFilterView } from '@renderer/utils/filterViewUtils';
import type { DashboardPayload, PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from '../products/ProductDetailDrawer';

type LinkMode = 'all' | 'ranking' | 'quadrant';
type TrendMetricKey = 'payAmount' | 'adCost' | 'totalGmv' | 'roi' | 'refundTotalAmount';
type RankingMetricKey = 'payAmount' | 'adCost' | 'roi' | 'momChange';

const trendMetricOptions: Array<{ label: string; value: TrendMetricKey }> = [
  { label: '支付金额', value: 'payAmount' },
  { label: '阿里妈妈花费', value: 'adCost' },
  { label: '广告成交金额', value: 'totalGmv' },
  { label: '阿里妈妈投产比', value: 'roi' },
  { label: '总退款金额', value: 'refundTotalAmount' }
];

const rankingMetricOptions: Array<{ label: string; value: RankingMetricKey }> = [
  { label: '支付金额', value: 'payAmount' },
  { label: '花费', value: 'adCost' },
  { label: '投产比', value: 'roi' },
  { label: '环比上周期', value: 'momChange' }
];

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  });
}

function formatPercent(value: number) {
  return `${((value || 0) * 100).toFixed(2)}%`;
}

export function DashboardPage() {
  const filters = useFilterStore();
  const { replaceFilters, setFilters } = useFilterStore();
  const { setLinkedProducts: setGlobalLinkedProducts, clearLinkedProducts: clearGlobalLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [sourceSheets, setSourceSheets] = useState<string[]>([]);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [products, setProducts] = useState<ProductTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkMode, setLinkMode] = useState<LinkMode>('all');
  const [linkedCodes, setLinkedCodes] = useState<string[]>([]);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>('payAmount');
  const [rankingMetric, setRankingMetric] = useState<RankingMetricKey>('payAmount');
  const [rankingSize, setRankingSize] = useState<number>(15);
  const [savedFilterViews, setSavedFilterViews] = useState<SavedFilterView[]>([]);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => {
      setPeriods(result.periods);
      setSourceSheets(result.sourceSheets);
    });
    setSavedFilterViews(loadSavedFilterViews());
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([window.ecomApi.analytics.getDashboard(filters), window.ecomApi.analytics.getProducts(filters)])
      .then(([dashboard, productRows]) => {
        setData(dashboard);
        setProducts(productRows);
      })
      .finally(() => setLoading(false));
  }, [filters.periodLabel, filters.keyword, filters.periodType, filters.sourceSheet]);

  const filteredProducts = useMemo(() => applyProductFilters(products, filters), [filters, products]);
  const activePeriod = useMemo(() => periods.find((item) => item.periodLabel === filters.periodLabel), [filters.periodLabel, periods]);
  const preferredProductPeriod = useMemo(() => periods.find((item) => item.hasProductData), [periods]);

  useEffect(() => {
    if (!activePeriod || activePeriod.hasProductData || !preferredProductPeriod) {
      return;
    }

    const onlyPeriodSelected =
      !filters.sourceSheet &&
      !filters.keyword &&
      (!filters.focusTag || filters.focusTag === 'all') &&
      filters.periodType === 'all' &&
      !filters.minPayAmount &&
      !filters.minAdCost &&
      !filters.minRefundRate &&
      (!filters.roiBucket || filters.roiBucket === 'all') &&
      (!filters.adShareBucket || filters.adShareBucket === 'all') &&
      (!filters.imageMode || filters.imageMode === 'all');

    if (onlyPeriodSelected && activePeriod.periodLabel !== preferredProductPeriod.periodLabel) {
      setFilters({ periodLabel: preferredProductPeriod.periodLabel });
    }
  }, [
    activePeriod,
    filters.adShareBucket,
    filters.focusTag,
    filters.imageMode,
    filters.keyword,
    filters.minAdCost,
    filters.minPayAmount,
    filters.minRefundRate,
    filters.periodType,
    filters.roiBucket,
    filters.sourceSheet,
    preferredProductPeriod,
    setFilters
  ]);

  const rankedProducts = useMemo(() => {
    const rows = [...filteredProducts];
    rows.sort((left, right) => {
      if (rankingMetric === 'momChange') {
        return (right.momChange ?? Number.NEGATIVE_INFINITY) - (left.momChange ?? Number.NEGATIVE_INFINITY);
      }
      return Number(right[rankingMetric] || 0) - Number(left[rankingMetric] || 0);
    });
    return rows.slice(0, rankingSize);
  }, [filteredProducts, rankingMetric, rankingSize]);

  const linkedProducts = useMemo(() => {
    if (linkMode === 'all' || !linkedCodes.length) {
      return filteredProducts;
    }
    return filteredProducts.filter((item) => linkedCodes.includes(item.productCodeNorm));
  }, [filteredProducts, linkMode, linkedCodes]);

  const summary = useMemo(() => {
    const naturalCount = filteredProducts.filter((item) => item.tags.includes('自然流强')).length;
    const adsCount = filteredProducts.filter((item) => item.tags.includes('广告驱动')).length;
    const highSpendCount = filteredProducts.filter((item) => item.tags.includes('高消耗低产出')).length;
    return { naturalCount, adsCount, highSpendCount };
  }, [filteredProducts]);

  const trendLabel = trendMetricOptions.find((item) => item.value === trendMetric)?.label || '支付金额';
  const rankingLabel = rankingMetricOptions.find((item) => item.value === rankingMetric)?.label || '支付金额';

  const trendOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => (trendMetric === 'roi' ? Number(value || 0).toFixed(2) : formatAmount(Number(value || 0)))
    },
    xAxis: {
      type: 'category',
      data: data?.trend.map((item) => item.periodLabel) ?? [],
      axisLabel: {
        interval: 0,
        rotate: 28,
        formatter: (value: string) => (value.length > 12 ? `${value.slice(0, 12)}...` : value)
      }
    },
    yAxis: {
      type: 'value',
      name: trendLabel
    },
    series: [
      {
        name: trendLabel,
        type: 'line',
        smooth: true,
        data: data?.trend.map((item) => Number(item[trendMetric] ?? 0)) ?? [],
        itemStyle: { color: '#1677ff' },
        lineStyle: { width: 3 }
      }
    ]
  };

  const rankingOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { data?: unknown[] }) => {
        const row = params.data ?? [];
        return [
          `货号：${String(row[2] ?? '-')}`,
          `商品：${String(row[3] ?? '-')}`,
          `${rankingLabel}：${rankingMetric === 'momChange' ? formatPercent(Number(row[0] ?? 0)) : formatAmount(Number(row[0] ?? 0))}`
        ].join('<br/>');
      }
    },
    grid: { left: 12, right: 24, top: 16, bottom: 12, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: rankedProducts.map((item) => item.productCodeNorm || item.productName),
      axisLabel: { formatter: (value: string) => (value.length > 16 ? `${value.slice(0, 16)}...` : value) }
    },
    series: [
      {
        type: 'bar',
        itemStyle: { color: '#1677ff' },
        data: rankedProducts.map((item) => [
          rankingMetric === 'momChange' ? item.momChange ?? 0 : Number(item[rankingMetric] || 0),
          item.imagePath || '',
          item.productCodeNorm,
          item.productName
        ])
      }
    ]
  };

  const quadrantOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { data?: unknown[] }) => {
        const row = params.data ?? [];
        return [
          `货号：${String(row[5] ?? '-')}`,
          `商品：${String(row[4] ?? '-')}`,
          `阿里妈妈花费：${formatAmount(Number(row[0] ?? 0))}`,
          `生参支付金额：${formatAmount(Number(row[1] ?? 0))}`,
          `阿里妈妈投产比：${Number(row[3] ?? 0).toFixed(2)}`
        ].join('<br/>');
      }
    },
    xAxis: { name: '阿里妈妈花费', type: 'value' },
    yAxis: { name: '生参支付金额', type: 'value' },
    series: [
      {
        type: 'scatter',
        symbolSize: (value: number[]) => Math.max(16, Math.min(Number(value[2] || 0), 50)),
        data: filteredProducts.map((item) => [item.adCost, item.payAmount, item.payQty, item.roi, item.productName, item.productCodeNorm])
      }
    ]
  };

  const handleRankingClick = (params: unknown) => {
    const chartParams = params as { dataIndex?: number };
    const row = rankedProducts[chartParams.dataIndex ?? -1];
    if (!row) {
      return;
    }

    setLinkMode('ranking');
    setLinkedCodes([row.productCodeNorm]);
    setGlobalLinkedProducts([row.productCodeNorm], `经营总览 / Top 商品排行 / ${row.productCodeNorm}`);
  };

  const handleQuadrantClick = (params: unknown) => {
    const chartParams = params as { data?: unknown[] };
    const productCodeNorm = String(chartParams.data?.[5] ?? '');
    if (!productCodeNorm) {
      return;
    }

    setLinkMode('quadrant');
    setLinkedCodes([productCodeNorm]);
    setGlobalLinkedProducts([productCodeNorm], '经营总览 / 单品散点');
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

  const handleExportRanking = () => {
    if (!rankedProducts.length) {
      message.warning('当前没有可导出的 Top 商品结果。');
      return;
    }

    const periodLabel = filters.periodLabel || '全部周期';
    const sourceSheet = filters.sourceSheet || '全部源sheet';
    exportProductRowsToCsv(rankedProducts, `经营总览-Top商品-${periodLabel}-${sourceSheet}.csv`, DEFAULT_PRODUCT_COLUMNS);
    message.success(`已导出 ${rankedProducts.length} 条 Top 商品结果。`);
  };

  const handleExportLinkedProducts = () => {
    if (!linkedProducts.length) {
      message.warning('当前没有可导出的联动商品池。');
      return;
    }

    const periodLabel = filters.periodLabel || '全部周期';
    const sourceSheet = filters.sourceSheet || '全部源sheet';
    exportProductRowsToCsv(linkedProducts, `经营总览-联动商品池-${periodLabel}-${sourceSheet}.csv`, DEFAULT_PRODUCT_COLUMNS);
    message.success(`已导出 ${linkedProducts.length} 条联动商品结果。`);
  };

  const applySavedFilterView = (view: SavedFilterView) => {
    replaceFilters(view.filters);
    message.success(`已切换到筛选视图：${view.name}`);
  };

  const removeSavedFilterView = (viewName: string) => {
    const nextViews = savedFilterViews.filter((item) => item.name !== viewName);
    setSavedFilterViews(nextViews);
    persistSavedFilterViews(nextViews);
    message.success(`已删除筛选视图：${viewName}`);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} sourceSheets={sourceSheets} />

      <Card
        className="panel-card"
        title="常用筛选视图"
        extra={<Tag color="blue">快捷切换</Tag>}
      >
        {!savedFilterViews.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="还没有保存过筛选视图。先在顶部把条件选好，再点“保存当前筛选”。"
          />
        ) : (
          <Space wrap size={12}>
            {savedFilterViews.map((view) => (
              <Card key={view.name} size="small" style={{ minWidth: 220 }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text strong>{view.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {view.filters.sourceSheet || '全部源 sheet'}
                    {view.filters.focusTag && view.filters.focusTag !== 'all' ? ` · ${view.filters.focusTag}` : ''}
                  </Typography.Text>
                  <Space>
                    <Button size="small" type="primary" onClick={() => applySavedFilterView(view)}>
                      直接查看
                    </Button>
                    <Button size="small" danger onClick={() => removeSavedFilterView(view.name)}>
                      删除
                    </Button>
                  </Space>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>

      <Alert
        type="success"
        showIcon
        message={`当前分析范围：${filters.sourceSheet || '全部源 sheet'}`}
        description={`当前命中 ${filteredProducts.length} 个商品样本，趋势包含 ${(data?.trend.length ?? 0)} 个周期点。切换源数据 sheet 或顶部二次筛选后，Top 商品、散点和联动商品池会一起刷新。`}
      />

      {activePeriod && !activePeriod.hasProductData ? (
        <Alert
          type="warning"
          showIcon
          message={`当前周期 ${activePeriod.periodLabel} 暂无商品经营数据`}
          description="你已经导入成功了，但这个周期只有退款分析数据。首页的支付金额、广告花费、Top 商品和散点图都依赖商品经营表，请把顶部周期切到最近一个有商品经营数据的周期，比如 4.1-4.12。"
        />
      ) : null}

      <Alert
        type="info"
        showIcon
        message="总览核心口径"
        description="支付统一看生参支付金额，投产统一看阿里妈妈花费和阿里妈妈投产比。首页重点看趋势、Top 商品排行，以及高花费低产出 / 低花费高产出的单品分布。"
      />

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <KPIStatCard title="生参支付总金额" value={data?.metrics.totalPayAmount ?? 0} />
        </Col>
        <Col span={6}>
          <KPIStatCard title="阿里妈妈花费" value={data?.metrics.totalAdCost ?? 0} />
        </Col>
        <Col span={6}>
          <KPIStatCard title="阿里妈妈投产比" value={data?.metrics.roi ?? 0} formatter={(value) => value.toFixed(2)} />
        </Col>
        <Col span={6}>
          <KPIStatCard title="总退款率" value={(data?.metrics.totalRefundRate ?? 0) * 100} suffix="%" formatter={(value) => value.toFixed(2)} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className="panel-card">
            <Statistic title="自然流强单品" value={summary.naturalCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="panel-card">
            <Statistic title="广告驱动单品" value={summary.adsCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="panel-card">
            <Statistic title="高消耗低产出单品" value={summary.highSpendCount} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            className="panel-card"
            title="流量 / 投放 / 成交趋势"
            extra={<Segmented value={trendMetric} options={trendMetricOptions} onChange={(value) => setTrendMetric(value as TrendMetricKey)} />}
          >
            <BaseChartCard title="" loading={loading} option={trendOption} height={360} />
          </Card>
        </Col>
        <Col span={10}>
          <Card
            className="panel-card"
            title="Top 商品排行"
            extra={
              <Space>
                <Select value={rankingMetric} options={rankingMetricOptions} style={{ width: 140 }} onChange={(value) => setRankingMetric(value as RankingMetricKey)} />
                <Select
                  value={rankingSize}
                  style={{ width: 100 }}
                  options={[
                    { label: 'Top 10', value: 10 },
                    { label: 'Top 15', value: 15 },
                    { label: 'Top 20', value: 20 }
                  ]}
                  onChange={setRankingSize}
                />
                <Button onClick={handleExportRanking}>导出 Top 商品</Button>
              </Space>
            }
          >
            <BaseChartCard title="" loading={loading} option={rankingOption} height={440} onEvents={{ click: handleRankingClick }} />
          </Card>
        </Col>
        <Col span={14}>
          <Card className="panel-card" title="单品散点：高花费低产出 / 低花费高产出">
            <BaseChartCard title="" loading={loading} option={quadrantOption} height={440} onEvents={{ click: handleQuadrantClick }} />
          </Card>
        </Col>
      </Row>

      <SavedViewBoard data={data} loading={loading} />
      <CustomAnalysisCard data={data} loading={loading} />

      <div className="page-stack">
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            联动商品池
          </Typography.Title>
          <Space>
            {linkMode !== 'all' ? (
              <Alert type="info" showIcon message={`当前已按${linkMode === 'ranking' ? 'Top 商品排行' : '单品散点'}联动筛选`} />
            ) : null}
            <Button onClick={handleExportLinkedProducts}>导出当前商品池</Button>
            <Button onClick={resetLinkedProducts} disabled={linkMode === 'all'}>
              清除联动
            </Button>
          </Space>
        </Space>
        <ProductDataTable data={linkedProducts} onRowClick={handleRowClick} />
      </div>

      <ProductDetailDrawer open={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
