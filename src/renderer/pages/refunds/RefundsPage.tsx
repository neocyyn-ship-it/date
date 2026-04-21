import { Col, Row, Space, Table, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import type { PeriodInfo, ProductDetail, ProductTableItem, RefundDiagnostics, RefundPeriodComparisonRow } from '@shared/types';
import { ProductDetailDrawer } from '../products/ProductDetailDrawer';

type RefundPool = 'pre' | 'post' | 'aftersale' | 'triple';

export function RefundsPage() {
  const filters = useFilterStore();
  const { setLinkedProducts: setGlobalLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<RefundDiagnostics | null>(null);
  const [comparison, setComparison] = useState<RefundPeriodComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePool, setActivePool] = useState<RefundPool>('triple');
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.ecomApi.analytics.getRefundDiagnostics(filters),
      window.ecomApi.analytics.getRefundPeriodComparison(filters)
    ]).then(([diagnostics, periodComparison]) => {
      setData(diagnostics);
      setComparison(periodComparison);
      setLoading(false);
    });
  }, [filters.periodLabel, filters.keyword, filters.periodType]);

  const linkedProducts = useMemo<ProductTableItem[]>(() => {
    if (!data) return [];
    if (activePool === 'pre') return data.preHighList;
    if (activePool === 'post') return data.postHighList;
    if (activePool === 'aftersale') return data.aftersaleHighList;
    return data.tripleHighList;
  }, [activePool, data]);

  const structureOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: data?.structureTrend.map((item) => item.periodLabel) ?? [] },
    yAxis: { type: 'value' },
    series: [
      { name: '发货前退款金额', type: 'bar', stack: 'refund', data: data?.structureTrend.map((item) => item.adCost) ?? [] },
      { name: '发货后退款金额', type: 'bar', stack: 'refund', data: data?.structureTrend.map((item) => item.totalGmv) ?? [] },
      { name: '售后退款金额', type: 'bar', stack: 'refund', data: data?.structureTrend.map((item) => item.refundTotalAmount) ?? [] }
    ]
  };

  const tableColumns = [
    { title: '货号', dataIndex: 'productCodeNorm' },
    { title: '商品名', dataIndex: 'productName' },
    { title: '发货前退款率', dataIndex: 'refundPreRate', render: (value: number) => `${(value * 100).toFixed(2)}%` },
    { title: '发货后退款率', dataIndex: 'refundPostRate', render: (value: number) => `${(value * 100).toFixed(2)}%` },
    { title: '售后退款率', dataIndex: 'refundAftersaleRate', render: (value: number) => `${(value * 100).toFixed(2)}%` },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, record: ProductTableItem) => (
        <Typography.Link onClick={() => setActivePool(record.tags.includes('高退款') ? 'triple' : activePool)}>联动查看</Typography.Link>
      )
    }
  ];

  const handleRowClick = async (row: ProductTableItem) => {
    const payload = await window.ecomApi.analytics.getProductDetail(row.productCodeNorm);
    setDetail(payload);
    setDetailOpen(true);
  };

  return (
    <div className="page-stack">
      <FilterBar periods={periods} />
      <Row gutter={[16, 16]}>
        <Col span={8}><KPIStatCard title="加权发货前退款率均值" value={(data?.avgPreRate ?? 0) * 100} suffix="%" /></Col>
        <Col span={8}><KPIStatCard title="加权发货后退款率均值" value={(data?.avgPostRate ?? 0) * 100} suffix="%" /></Col>
        <Col span={8}><KPIStatCard title="加权售后退款率均值" value={(data?.avgAftersaleRate ?? 0) * 100} suffix="%" /></Col>
      </Row>
      <BaseChartCard title="退款结构图" loading={loading} option={structureOption} />

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Table className="panel-card" rowKey="productCodeNorm" columns={tableColumns} dataSource={data?.preHighList ?? []} title={() => '高于平均发货前退款率的商品'} pagination={{ pageSize: 8 }} />
        </Col>
        <Col span={12}>
          <Table className="panel-card" rowKey="productCodeNorm" columns={tableColumns} dataSource={data?.postHighList ?? []} title={() => '高于平均发货后退款率的商品'} pagination={{ pageSize: 8 }} />
        </Col>
        <Col span={12}>
          <Table className="panel-card" rowKey="productCodeNorm" columns={tableColumns} dataSource={data?.aftersaleHighList ?? []} title={() => '高于平均售后退款率的商品'} pagination={{ pageSize: 8 }} />
        </Col>
        <Col span={12}>
          <Table className="panel-card" rowKey="productCodeNorm" columns={tableColumns} dataSource={data?.tripleHighList ?? []} title={() => '三高商品池'} pagination={{ pageSize: 8 }} />
        </Col>
      </Row>

      <Table
        className="panel-card"
        rowKey="productCodeNorm"
        title={() => '周环比分析表'}
        dataSource={comparison}
        columns={[
          { title: '货号', dataIndex: 'productCodeNorm' },
          { title: '商品名', dataIndex: 'productName' },
          { title: '本周期支付金额', dataIndex: 'currentPayAmount' },
          { title: '上周期支付金额', dataIndex: 'previousPayAmount' },
          { title: '环比', dataIndex: 'payMom', render: (value: number | null) => (value === null ? '--' : `${(value * 100).toFixed(2)}%`) },
          { title: '本周期总退款率', dataIndex: 'currentRefundRate', render: (value: number) => `${(value * 100).toFixed(2)}%` },
          { title: '上周期总退款率', dataIndex: 'previousRefundRate', render: (value: number) => `${(value * 100).toFixed(2)}%` },
          { title: '退款率变化值', dataIndex: 'refundRateDiff', render: (value: number | null) => (value === null ? '--' : `${(value * 100).toFixed(2)}%`) }
        ]}
      />

      <Space>
        <Typography.Text strong>联动异常商品池：</Typography.Text>
        <Typography.Link
          onClick={() => {
            setActivePool('pre');
            setGlobalLinkedProducts((data?.preHighList ?? []).map((item) => item.productCodeNorm), '退款诊断 / 发货前异常');
          }}
        >
          发货前异常
        </Typography.Link>
        <Typography.Link
          onClick={() => {
            setActivePool('post');
            setGlobalLinkedProducts((data?.postHighList ?? []).map((item) => item.productCodeNorm), '退款诊断 / 发货后异常');
          }}
        >
          发货后异常
        </Typography.Link>
        <Typography.Link
          onClick={() => {
            setActivePool('aftersale');
            setGlobalLinkedProducts((data?.aftersaleHighList ?? []).map((item) => item.productCodeNorm), '退款诊断 / 售后异常');
          }}
        >
          售后异常
        </Typography.Link>
        <Typography.Link
          onClick={() => {
            setActivePool('triple');
            setGlobalLinkedProducts((data?.tripleHighList ?? []).map((item) => item.productCodeNorm), '退款诊断 / 三高商品池');
          }}
        >
          三高商品池
        </Typography.Link>
      </Space>

      <ProductDataTable data={linkedProducts} onRowClick={handleRowClick} />
      <ProductDetailDrawer open={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
