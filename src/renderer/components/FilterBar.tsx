import { Card, Input, Select, Space } from 'antd';
import type { PeriodInfo } from '@shared/types';
import { useFilterStore } from '@renderer/stores/filterStore';

interface Props {
  periods: PeriodInfo[];
}

export function FilterBar({ periods }: Props) {
  const { periodLabel, keyword, setFilters } = useFilterStore();
  return (
    <Card className="panel-card">
      <Space wrap size={16}>
        <Select
          placeholder="选择周期"
          style={{ width: 240 }}
          allowClear
          value={periodLabel}
          options={periods.map((item) => ({ label: `${item.periodLabel} (${item.periodType})`, value: item.periodLabel }))}
          onChange={(value) => setFilters({ periodLabel: value })}
        />
        <Input.Search
          placeholder="搜索商品名 / 货号"
          allowClear
          style={{ width: 300 }}
          value={keyword}
          onChange={(event) => setFilters({ keyword: event.target.value })}
        />
        <Select placeholder="平台 / 来源（预留）" style={{ width: 180 }} disabled options={[]} />
        <Select placeholder="商品分类（预留）" style={{ width: 180 }} disabled options={[]} />
      </Space>
    </Card>
  );
}
