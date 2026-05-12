import { Alert, Button, Card, Col, Row, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import { exportProductRowsToCsv } from '@renderer/utils/exportProductRows';
import { DEFAULT_PRODUCT_COLUMNS } from '@renderer/utils/productColumns';
import { applyProductFilters } from '@renderer/utils/productFilters';
import type { MarketingEfficiency, PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from '../products/ProductDetailDrawer';

type LinkMode = 'natural' | 'ads' | 'highSpend';

interface BucketSummary {
  key: LinkMode;
  title: string;
  description: string;
  tagColor: string;
  rows: ProductTableItem[];
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  });
}

export function MarketingPage() {
  const filters = useFilterStore();
  const { setLinkedProducts: setGlobalLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [sourceSheets, setSourceSheets] = useState<string[]>([]);
  const [data, setData] = useState<MarketingEfficiency | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkMode, setLinkMode] = useState<LinkMode>('natural');
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => {
      setPeriods(result.periods);
      setSourceSheets(result.sourceSheets);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    window.ecomApi.analytics
      .getMarketing(filters)
      .then((result) => setData(result))
      .finally(() => setLoading(false));
  }, [filters.periodLabel, filters.keyword, filters.periodType, filters.sourceSheet]);

  const buckets = useMemo<BucketSummary[]>(() => {
    return [
      {
        key: 'natural',
        title: '自然流单品',
        description: '生参支付金额高、阿里妈妈花费低、广告成交占比低的商品。',
        tagColor: 'green',
        rows: applyProductFilters(data?.naturalStrong ?? [], filters)
      },
      {
        key: 'ads',
        title: '广告驱动单品',
        description: '阿里妈妈花费高、广告成交占比高，明显依赖投放拉动的商品。',
        tagColor: 'blue',
        rows: applyProductFilters(data?.adsDriven ?? [], filters)
      },
      {
        key: 'highSpend',
        title: '高消耗低投产单品',
        description: '阿里妈妈花费高但投产偏低，优先排查是否继续放量。',
        tagColor: 'gold',
        rows: applyProductFilters(data?.highSpendLowOutput ?? [], filters)
      }
    ];
  }, [data, filters]);

  const activeBucket = buckets.find((item) => item.key === linkMode) ?? buckets[0];

  const summaryColumns: ColumnsType<BucketSummary> = [
    {
      title: '商品池',
      dataIndex: 'title',
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Typography.Text strong>{value}</Typography.Text>
            <Tag color={record.tagColor}>{record.rows.length} 个</Tag>
          </Space>
          <Typography.Text type="secondary">{record.description}</Typography.Text>
        </Space>
      )
    },
    {
      title: '代表货号',
      key: 'sample',
      render: (_, record) =>
        record.rows
          .slice(0, 3)
          .map((item) => item.productCodeNorm)
          .join(' / ') || '--'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Typography.Link
          onClick={() => {
            setLinkMode(record.key);
            setGlobalLinkedProducts(
              record.rows.map((item) => item.productCodeNorm),
              `渠道营销 / ${record.title}`
            );
          }}
        >
          查看商品池
        </Typography.Link>
      )
    }
  ];

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: data?.trend.map((item) => item.periodLabel) ?? [] },
    yAxis: [{ type: 'value' }, { type: 'value' }],
    series: [
      { name: '阿里妈妈投产比', type: 'line', smooth: true, data: data?.trend.map((item) => item.roi ?? 0) ?? [] },
      { name: '阿里妈妈花费', type: 'bar', yAxisIndex: 1, data: data?.trend.map((item) => item.adCost) ?? [] }
    ]
  };

  const quadrantRows = useMemo(() => applyProductFilters(data?.quadrant.map((item) => ({
    productId: item.productId,
    productCodeNorm: item.productCodeNorm,
    productName: item.productName,
    imagePath: item.imagePath,
    payAmount: item.payAmount,
    adCost: item.spend,
    directGmv: 0,
    indirectGmv: 0,
    totalGmv: item.payAmount,
    roi: item.roi,
    payQty: item.bubbleSize,
    adAttributedShare: 0,
    successRefundAmount: 0,
    refundPreRate: 0,
    refundPostRate: 0,
    refundAftersaleRate: 0,
    momChange: null,
    tags: []
  })) ?? [], filters), [data, filters]);

  const quadrantOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { data?: unknown[] }) => {
        const point = params.data ?? [];
        return [
          `货号：${String(point[4] ?? '-')}`,
          `支付：${formatAmount(Number(point[1] ?? 0))}`,
          `花费：${formatAmount(Number(point[0] ?? 0))}`,
          `投产比：${Number(point[3] ?? 0).toFixed(2)}`
        ].join('<br/>');
      }
    },
    xAxis: { name: '阿里妈妈花费' },
    yAxis: { name: '生参支付金额' },
    series: [
      {
        type: 'scatter',
        symbolSize: (value: number[]) => Math.max(18, Number(value[2] || 0)),
        data: quadrantRows.map((item) => [item.adCost, item.payAmount, item.payQty, item.roi, item.productCodeNorm, item.productName])
      }
    ]
  };

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setDetailOpen(true);
  };

  const handleExportBucket = () => {
    if (!activeBucket.rows.length) {
      message.warning('当前没有可导出的营销商品池。');
      return;
    }

    const periodLabel = filters.periodLabel || '全部周期';
    const sourceSheet = filters.sourceSheet || '全部源sheet';
    exportProductRowsToCsv(activeBucket.rows, `渠道营销-${activeBucket.title}-${periodLabel}-${sourceSheet}.csv`, DEFAULT_PRODUCT_COLUMNS);
    message.success(`已导出 ${activeBucket.rows.length} 条${activeBucket.title}结果。`);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} sourceSheets={sourceSheets} />

      <Alert
        type="success"
        showIcon
        message={`当前分析范围：${filters.sourceSheet || '全部源 sheet'}`}
        description={`当前命中 ${quadrantRows.length} 个营销样本，识别出 ${buckets[0]?.rows.length ?? 0} 个自然流单品、${buckets[1]?.rows.length ?? 0} 个广告驱动单品、${buckets[2]?.rows.length ?? 0} 个高消耗低投产单品。`}
      />

      <Alert
        type="info"
        showIcon
        message="核心口径"
        description="支付统一看生参支付金额，投产统一看阿里妈妈花费和投产比。顶部二次筛选会直接作用于营销商品池和散点图。"
      />

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <KPIStatCard title="阿里妈妈花费" value={data?.kpis.adCost ?? 0} />
        </Col>
        <Col span={6}>
          <KPIStatCard title="阿里妈妈成交金额" value={data?.kpis.adRevenue ?? 0} />
        </Col>
        <Col span={6}>
          <KPIStatCard title="阿里妈妈投产比" value={data?.kpis.roi ?? 0} formatter={(value) => value.toFixed(2)} />
        </Col>
        <Col span={6}>
          <KPIStatCard title="点击率" value={(data?.kpis.ctr ?? 0) * 100} suffix="%" formatter={(value) => value.toFixed(2)} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <BaseChartCard title="阿里妈妈花费 / 投产趋势" loading={loading} option={trendOption} />
        </Col>
        <Col span={12}>
          <BaseChartCard title="单品散点：高花费低产出 / 低花费高产出" loading={loading} option={quadrantOption} />
        </Col>
      </Row>

      <Card className="panel-card" title="营销商品池总览">
        <Table rowKey="key" pagination={false} columns={summaryColumns} dataSource={buckets} />
      </Card>

      <Card
        className="panel-card"
        title={`${activeBucket.title}明细`}
        extra={
          <Space>
            <Typography.Text type="secondary">{activeBucket.description}</Typography.Text>
            <Button onClick={handleExportBucket}>导出当前商品池</Button>
          </Space>
        }
      >
        <ProductDataTable data={activeBucket.rows} onRowClick={handleRowClick} paginationSize={8} />
      </Card>

      <ProductDetailDrawer open={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
