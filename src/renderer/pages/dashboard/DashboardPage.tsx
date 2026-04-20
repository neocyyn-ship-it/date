import { Col, Row } from 'antd';
import { useEffect, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { useFilterStore } from '@renderer/stores/filterStore';
import type { DashboardPayload, PeriodInfo } from '@shared/types';

export function DashboardPage() {
  const filters = useFilterStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => setPeriods(result.periods));
  }, []);

  useEffect(() => {
    setLoading(true);
    window.ecomApi.analytics.getDashboard(filters).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [filters.periodLabel, filters.keyword]);

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
        data: data?.quadrant.map((item) => [item.spend, item.payAmount, item.bubbleSize, item.roi, item.productName]) ?? []
      }
    ]
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
        <Col span={10}><BaseChartCard title="Top 商品排行" loading={loading} option={rankingOption} /></Col>
        <Col span={14}><BaseChartCard title="投入产出散点图" loading={loading} option={quadrantOption} /></Col>
      </Row>
    </div>
  );
}
