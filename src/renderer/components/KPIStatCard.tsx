import { Card, Statistic } from 'antd';

interface Props {
  title: string;
  value: number;
  suffix?: string;
  precision?: number;
}

export function KPIStatCard({ title, value, suffix, precision = 2 }: Props) {
  return (
    <Card className="panel-card">
      <Statistic title={title} value={value} precision={precision} suffix={suffix} />
    </Card>
  );
}
