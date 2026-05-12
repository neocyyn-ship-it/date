import { Card, Statistic } from 'antd';

interface Props {
  title: string;
  value: number;
  suffix?: string;
  precision?: number;
  formatter?: (value: number) => string;
}

function defaultFormatter(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 2
  });
}

export function KPIStatCard({ title, value, suffix, precision = 2, formatter }: Props) {
  return (
    <Card className="panel-card">
      <Statistic title={title} value={value} precision={precision} suffix={suffix} formatter={(raw) => (formatter ? formatter(Number(raw || 0)) : defaultFormatter(Number(raw || 0)))} />
    </Card>
  );
}
