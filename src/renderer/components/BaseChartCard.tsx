import ReactECharts from 'echarts-for-react';
import { Card, Empty, Spin } from 'antd';

interface Props {
  title: string;
  loading?: boolean;
  option: Record<string, unknown>;
  height?: number;
}

export function BaseChartCard({ title, loading, option, height = 340 }: Props) {
  return (
    <Card className="panel-card" title={title}>
      {loading ? (
        <div className="chart-placeholder">
          <Spin />
        </div>
      ) : !option?.series || (Array.isArray(option.series) && option.series.length === 0) ? (
        <div className="chart-placeholder">
          <Empty description="暂无图表数据" />
        </div>
      ) : (
        <ReactECharts style={{ height }} option={option} notMerge lazyUpdate />
      )}
    </Card>
  );
}
