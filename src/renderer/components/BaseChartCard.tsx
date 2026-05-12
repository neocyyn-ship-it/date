import { Card, Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';

interface Props {
  title: string;
  loading?: boolean;
  option: Record<string, unknown>;
  height?: number;
  onEvents?: Record<string, (params: unknown) => void>;
}

export function BaseChartCard({ title, loading, option, height = 340, onEvents }: Props) {
  const series = option?.series;
  const isEmpty = !series || (Array.isArray(series) && series.length === 0);

  return (
    <Card className="panel-card" title={title}>
      {loading ? (
        <div className="chart-placeholder">
          <Spin />
        </div>
      ) : isEmpty ? (
        <div className="chart-placeholder">
          <Empty description="暂无图表数据" />
        </div>
      ) : (
        <ReactECharts style={{ height }} option={option} notMerge lazyUpdate onEvents={onEvents} />
      )}
    </Card>
  );
}
