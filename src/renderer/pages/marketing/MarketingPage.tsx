import { Col, Row, Table } from 'antd';
import { useEffect, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { useFilterStore } from '@renderer/stores/filterStore';
import type { MarketingEfficiency, PeriodInfo } from '@shared/types';

export function MarketingPage() {
  const filters = useFilterStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<MarketingEfficiency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);
  useEffect(() => {
    setLoading(true);
    window.ecomApi.analytics.getMarketing(filters).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [filters.periodLabel, filters.keyword]);

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
    series: [{ type: 'scatter', data: data?.quadrant.map((item) => [item.spend, item.payAmount, item.roi, item.productName]) ?? [] }]
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
        <Col span={24}>
          <Table
            className="panel-card"
            rowKey="productCodeNorm"
            pagination={false}
            dataSource={[...(data?.naturalStrong ?? []), ...(data?.adsDriven ?? []), ...(data?.highSpendLowOutput ?? [])].slice(0, 20)}
            columns={[
              { title: '货号', dataIndex: 'productCodeNorm' },
              { title: '商品名', dataIndex: 'productName' },
              { title: '支付金额', dataIndex: 'payAmount' },
              { title: '花费', dataIndex: 'adCost' },
              { title: 'ROI', dataIndex: 'roi' },
              { title: '标签', dataIndex: 'tags', render: (tags: string[]) => tags.join(' / ') }
            ]}
          />
        </Col>
      </Row>
    </div>
  );
}
