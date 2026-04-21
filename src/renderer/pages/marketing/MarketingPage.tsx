import { Alert, Col, Row, Space, Table, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { ProductDataTable } from '@renderer/components/ProductDataTable';
import { useFilterStore } from '@renderer/stores/filterStore';
import { useLinkStore } from '@renderer/stores/linkStore';
import type { MarketingEfficiency, PeriodInfo, ProductDetail, ProductTableItem } from '@shared/types';
import { ProductDetailDrawer } from '../products/ProductDetailDrawer';

type LinkMode = 'all' | 'natural' | 'ads' | 'highSpend';

export function MarketingPage() {
  const filters = useFilterStore();
  const { setLinkedProducts: setGlobalLinkedProducts } = useLinkStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<MarketingEfficiency | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkMode, setLinkMode] = useState<LinkMode>('all');
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);

  useEffect(() => {
    setLoading(true);
    window.ecomApi.analytics.getMarketing(filters).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [filters.periodLabel, filters.keyword, filters.periodType]);

  const linkedProducts = useMemo(() => {
    if (!data) return [];
    if (linkMode === 'natural') return data.naturalStrong;
    if (linkMode === 'ads') return data.adsDriven;
    if (linkMode === 'highSpend') return data.highSpendLowOutput;
    return [...data.naturalStrong, ...data.adsDriven, ...data.highSpendLowOutput].slice(0, 50);
  }, [data, linkMode]);

  const trendOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data?.trend.map((item) => item.periodLabel) ?? [] },
    yAxis: [{ type: 'value' }, { type: 'value' }],
    series: [
      { name: 'ROI', type: 'line', data: data?.trend.map((item) => item.roi) ?? [] },
      { name: '广告花费', type: 'bar', yAxisIndex: 1, data: data?.trend.map((item) => item.adCost) ?? [] }
    ]
  };

  const quadrantOption = {
    tooltip: { trigger: 'item' },
    xAxis: { name: '花费' },
    yAxis: { name: '产出' },
    series: [
      {
        type: 'scatter',
        data: data?.quadrant.map((item) => [item.spend, item.payAmount, item.roi, item.productName]) ?? []
      }
    ]
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
        <Col span={6}><KPIStatCard title="广告花费" value={data?.kpis.adCost ?? 0} /></Col>
        <Col span={6}><KPIStatCard title="广告成交金额" value={data?.kpis.adRevenue ?? 0} /></Col>
        <Col span={4}><KPIStatCard title="ROI" value={data?.kpis.roi ?? 0} /></Col>
        <Col span={4}><KPIStatCard title="CPC" value={data?.kpis.cpc ?? 0} /></Col>
        <Col span={4}><KPIStatCard title="点击率" value={(data?.kpis.ctr ?? 0) * 100} suffix="%" /></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col span={12}><BaseChartCard title="广告 ROI 趋势图" loading={loading} option={trendOption} /></Col>
        <Col span={12}><BaseChartCard title="波士顿矩阵" loading={loading} option={quadrantOption} /></Col>
      </Row>

      <Space wrap>
        <Typography.Text strong>营销联动商品池</Typography.Text>
        <Space.Compact>
          <Alert type="info" showIcon message={`当前视图：${linkMode === 'all' ? '综合商品池' : linkMode === 'natural' ? '自然流强' : linkMode === 'ads' ? '广告驱动' : '高消耗低产出'}`} />
        </Space.Compact>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Table
            className="panel-card"
            rowKey="productCodeNorm"
            pagination={false}
            dataSource={[
              { key: 'natural', label: '自然流强商品', count: data?.naturalStrong.length ?? 0, description: '支付金额高、花费低、广告成交占比低' },
              { key: 'ads', label: '广告驱动商品', count: data?.adsDriven.length ?? 0, description: '花费高、广告成交占比高' },
              { key: 'highSpend', label: '高消耗低产出', count: data?.highSpendLowOutput.length ?? 0, description: '花费高、ROI低' }
            ]}
            columns={[
              { title: '分类', dataIndex: 'label' },
              { title: '商品数', dataIndex: 'count' },
              { title: '判定逻辑', dataIndex: 'description' },
              {
                title: '操作',
                key: 'action',
                render: (_value, record: { key: LinkMode; label: string; count: number; description: string }) => (
                  <Typography.Link
                    onClick={() => {
                      setLinkMode(record.key);
                      const nextProducts =
                        record.key === 'natural'
                          ? data?.naturalStrong ?? []
                          : record.key === 'ads'
                            ? data?.adsDriven ?? []
                            : data?.highSpendLowOutput ?? [];
                      setGlobalLinkedProducts(
                        nextProducts.map((item) => item.productCodeNorm),
                        `渠道营销 / ${record.label}`
                      );
                    }}
                  >
                    查看商品池
                  </Typography.Link>
                )
              }
            ]}
          />
        </Col>
      </Row>

      <ProductDataTable data={linkedProducts} onRowClick={handleRowClick} />
      <ProductDetailDrawer open={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
