import { Alert, Button, Card, Col, Row, Segmented, Space, Table, Typography, message } from 'antd';
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
import { exportRefundComparisonRowsToCsv } from '@renderer/utils/exportRefundComparisonRows';
import { applyProductFilters } from '@renderer/utils/productFilters';
import type { PeriodInfo, ProductDetail, ProductTableItem, RefundDiagnostics, RefundPeriodComparisonRow } from '@shared/types';
import { ProductDetailDrawer } from '../products/ProductDetailDrawer';

type RefundPool = 'pre' | 'post' | 'aftersale' | 'triple';

interface RefundPoolSummary {
  key: RefundPool;
  title: string;
  description: string;
  count: number;
  rows: ProductTableItem[];
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  });
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) {
    return '--';
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function RefundsPage() {
  const filters = useFilterStore();
  const { setLinkedProducts: setGlobalLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [sourceSheets, setSourceSheets] = useState<string[]>([]);
  const [data, setData] = useState<RefundDiagnostics | null>(null);
  const [comparison, setComparison] = useState<RefundPeriodComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePool, setActivePool] = useState<RefundPool>('triple');
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
    Promise.all([
      window.ecomApi.analytics.getRefundDiagnostics(filters),
      window.ecomApi.analytics.getRefundPeriodComparison(filters)
    ])
      .then(([diagnostics, periodComparison]) => {
        setData(diagnostics);
        setComparison(periodComparison);
      })
      .finally(() => setLoading(false));
  }, [filters.periodLabel, filters.keyword, filters.periodType, filters.sourceSheet]);

  const pools = useMemo<RefundPoolSummary[]>(() => {
    return [
      {
        key: 'pre',
        title: '发货前异常',
        description: '发货前退款率高于当前加权均值的商品。',
        count: applyProductFilters(data?.preHighList ?? [], filters).length,
        rows: applyProductFilters(data?.preHighList ?? [], filters)
      },
      {
        key: 'post',
        title: '发货后异常',
        description: '发货后退款率高于当前加权均值的商品。',
        count: applyProductFilters(data?.postHighList ?? [], filters).length,
        rows: applyProductFilters(data?.postHighList ?? [], filters)
      },
      {
        key: 'aftersale',
        title: '售后异常',
        description: '售后退款率高于当前加权均值的商品。',
        count: applyProductFilters(data?.aftersaleHighList ?? [], filters).length,
        rows: applyProductFilters(data?.aftersaleHighList ?? [], filters)
      },
      {
        key: 'triple',
        title: '三高商品池',
        description: '同时高于三类退款率均值的商品，优先排查。',
        count: applyProductFilters(data?.tripleHighList ?? [], filters).length,
        rows: applyProductFilters(data?.tripleHighList ?? [], filters)
      }
    ];
  }, [data, filters]);

  const activeSummary = pools.find((item) => item.key === activePool) ?? pools[0];

  const structureOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: data?.structureTrend.map((item) => item.periodLabel) ?? [] },
    yAxis: { type: 'value' },
    series: [
      { name: '发货前退款金额', type: 'bar', stack: 'refund', data: data?.structureTrend.map((item) => item.adCost) ?? [] },
      { name: '发货后退款金额', type: 'bar', stack: 'refund', data: data?.structureTrend.map((item) => item.totalGmv) ?? [] },
      { name: '售后退款金额', type: 'bar', stack: 'refund', data: data?.structureTrend.map((item) => item.refundTotalAmount ?? 0) ?? [] }
    ]
  };

  const poolColumns: ColumnsType<RefundPoolSummary> = [
    {
      title: '异常商品池',
      dataIndex: 'title',
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.description}</Typography.Text>
        </Space>
      )
    },
    {
      title: '商品数',
      dataIndex: 'count'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Typography.Link
          onClick={() => {
            setActivePool(record.key);
            setGlobalLinkedProducts(
              record.rows.map((item) => item.productCodeNorm),
              `退款诊断 / ${record.title}`
            );
          }}
        >
          查看商品池
        </Typography.Link>
      )
    }
  ];

  const comparisonColumns: ColumnsType<RefundPeriodComparisonRow> = [
    { title: '货号', dataIndex: 'productCodeNorm', key: 'productCodeNorm', width: 140 },
    { title: '商品名', dataIndex: 'productName', key: 'productName', width: 220, ellipsis: true },
    { title: '本周期支付金额', dataIndex: 'currentPayAmount', key: 'currentPayAmount', render: (value: number) => formatAmount(value) },
    { title: '上周期支付金额', dataIndex: 'previousPayAmount', key: 'previousPayAmount', render: (value: number) => formatAmount(value) },
    { title: '支付环比', dataIndex: 'payMom', key: 'payMom', render: (value: number | null) => formatPercent(value) },
    { title: '本周期总退款率', dataIndex: 'currentRefundRate', key: 'currentRefundRate', render: (value: number) => formatPercent(value) },
    { title: '上周期总退款率', dataIndex: 'previousRefundRate', key: 'previousRefundRate', render: (value: number) => formatPercent(value) },
    { title: '退款率变化值', dataIndex: 'refundRateDiff', key: 'refundRateDiff', render: (value: number | null) => formatPercent(value) }
  ];

  const filteredComparison = useMemo(() => {
    return comparison.filter((item) => {
      if (filters.minPayAmount !== undefined && item.currentPayAmount < filters.minPayAmount) {
        return false;
      }
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        return item.productCodeNorm.toLowerCase().includes(keyword) || item.productName.toLowerCase().includes(keyword);
      }
      return true;
    });
  }, [comparison, filters.keyword, filters.minPayAmount]);

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setDetailOpen(true);
  };

  const handleExportPool = () => {
    if (!activeSummary?.rows.length) {
      message.warning('当前没有可导出的异常商品池。');
      return;
    }

    const periodLabel = filters.periodLabel || '全部周期';
    const sourceSheet = filters.sourceSheet || '全部源sheet';
    exportProductRowsToCsv(activeSummary.rows, `退款诊断-${activeSummary.title}-${periodLabel}-${sourceSheet}.csv`, DEFAULT_PRODUCT_COLUMNS);
    message.success(`已导出 ${activeSummary.rows.length} 条${activeSummary.title}结果。`);
  };

  const handleExportComparison = () => {
    if (!filteredComparison.length) {
      message.warning('当前没有可导出的周环比结果。');
      return;
    }

    const periodLabel = filters.periodLabel || '全部周期';
    const sourceSheet = filters.sourceSheet || '全部源sheet';
    exportRefundComparisonRowsToCsv(filteredComparison, `退款周环比-${periodLabel}-${sourceSheet}.csv`);
    message.success(`已导出 ${filteredComparison.length} 条周环比结果。`);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} sourceSheets={sourceSheets} />

      <Alert
        type="success"
        showIcon
        message={`当前分析范围：${filters.sourceSheet || '全部源 sheet'}`}
        description={`当前命中 ${filteredComparison.length} 个退款对比商品，异常商品池合计 ${pools.reduce((sum, item) => sum + item.count, 0)} 条记录，三高商品 ${pools.find((item) => item.key === 'triple')?.count ?? 0} 个。`}
      />

      <Alert
        type="info"
        showIcon
        message="退款诊断口径"
        description="三类退款率均值都按加权均值计算。顶部的经营标签、最低支付金额和关键词会直接作用于异常商品池。"
      />

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <KPIStatCard title="加权发货前退款率均值" value={(data?.avgPreRate ?? 0) * 100} suffix="%" formatter={(value) => value.toFixed(2)} />
        </Col>
        <Col span={8}>
          <KPIStatCard title="加权发货后退款率均值" value={(data?.avgPostRate ?? 0) * 100} suffix="%" formatter={(value) => value.toFixed(2)} />
        </Col>
        <Col span={8}>
          <KPIStatCard title="加权售后退款率均值" value={(data?.avgAftersaleRate ?? 0) * 100} suffix="%" formatter={(value) => value.toFixed(2)} />
        </Col>
      </Row>

      <BaseChartCard title="退款结构趋势" loading={loading} option={structureOption} height={340} />

      <Card className="panel-card" title="异常商品池总览">
        <Table rowKey="key" pagination={false} columns={poolColumns} dataSource={pools} />
      </Card>

      <Card
        className="panel-card"
        title={activeSummary?.title || '异常商品池'}
        extra={
          <Space>
            <Segmented
              value={activePool}
              options={pools.map((item) => ({ label: item.title, value: item.key }))}
              onChange={(value) => setActivePool(value as RefundPool)}
            />
            <Button onClick={handleExportPool}>导出当前异常池</Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {activeSummary?.description || ''}
        </Typography.Paragraph>
        <ProductDataTable data={activeSummary?.rows ?? []} onRowClick={handleRowClick} paginationSize={8} />
      </Card>

      <Card className="panel-card" title="周环比分析表" extra={<Button onClick={handleExportComparison}>导出周环比表</Button>}>
        <Table rowKey="productCodeNorm" columns={comparisonColumns} dataSource={filteredComparison} scroll={{ x: 1200 }} />
      </Card>

      <ProductDetailDrawer open={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
