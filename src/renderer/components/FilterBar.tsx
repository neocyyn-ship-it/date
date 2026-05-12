import { Button, Card, Input, InputNumber, Select, Space, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BUSINESS_TAGS } from '@shared/constants/business';
import { useFilterStore } from '@renderer/stores/filterStore';
import { loadSavedFilterViews, persistSavedFilterViews, type SavedFilterView } from '@renderer/utils/filterViewUtils';
import type { FilterState, PeriodInfo } from '@shared/types';

interface Props {
  periods: PeriodInfo[];
  sourceSheets?: string[];
}

const periodTypeOptions = [
  { label: '全部周期类型', value: 'all' },
  { label: '周维度', value: 'weekly_exact' },
  { label: '区间维度', value: 'range_exact' },
  { label: '近 30 天', value: 'rolling_30d' },
  { label: '整月', value: 'monthly' }
];

const roiBucketOptions = [
  { label: '全部 ROI', value: 'all' },
  { label: 'ROI < 1', value: 'lt1' },
  { label: '1 ≤ ROI < 2', value: '1to2' },
  { label: 'ROI ≥ 2', value: 'gte2' }
];

const adShareBucketOptions = [
  { label: '全部广告成交占比', value: 'all' },
  { label: '广告成交占比 < 30%', value: 'lt30' },
  { label: '30% ≤ 广告成交占比 < 60%', value: '30to60' },
  { label: '广告成交占比 ≥ 60%', value: 'gte60' }
];

const imageModeOptions = [
  { label: '全部图片状态', value: 'all' },
  { label: '只看有图商品', value: 'withImage' },
  { label: '只看无图商品', value: 'withoutImage' }
];

export function FilterBar({ periods, sourceSheets = [] }: Props) {
  const {
    periodLabel,
    periodType,
    sourceSheet,
    focusTag,
    minPayAmount,
    minAdCost,
    minRefundRate,
    roiBucket,
    adShareBucket,
    imageMode,
    keyword,
    setFilters,
    resetFilters,
    replaceFilters
  } = useFilterStore();

  const [savedViews, setSavedViews] = useState<SavedFilterView[]>([]);

  useEffect(() => {
    setSavedViews(loadSavedFilterViews());
  }, []);

  useEffect(() => {
    if (!periods.length) {
      return;
    }

    const preferredPeriod = periods.find((item) => item.hasProductData) ?? periods[0];
    const hasCurrentPeriod = periodLabel ? periods.some((item) => item.periodLabel === periodLabel) : false;
    if (!periodLabel || !hasCurrentPeriod) {
      setFilters({ periodLabel: preferredPeriod.periodLabel });
    }
  }, [periodLabel, periods, setFilters]);

  useEffect(() => {
    if (!sourceSheets.length || !sourceSheet) {
      return;
    }

    if (!sourceSheets.includes(sourceSheet)) {
      setFilters({ sourceSheet: undefined });
    }
  }, [setFilters, sourceSheet, sourceSheets]);

  const currentFilters = useMemo<Partial<FilterState>>(
    () => ({
      periodLabel,
      periodType,
      sourceSheet,
      focusTag,
      minPayAmount,
      minAdCost,
      minRefundRate,
      roiBucket,
      adShareBucket,
      imageMode,
      keyword
    }),
    [adShareBucket, focusTag, imageMode, keyword, minAdCost, minPayAmount, minRefundRate, periodLabel, periodType, roiBucket, sourceSheet]
  );

  const handleSaveCurrentView = () => {
    const name = window.prompt('请输入筛选视图名称');
    if (!name) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const nextViews = [
      ...savedViews.filter((item) => item.name !== trimmedName),
      { name: trimmedName, filters: currentFilters }
    ];

    setSavedViews(nextViews);
    persistSavedFilterViews(nextViews);
    message.success(`已保存筛选视图：${trimmedName}`);
  };

  const handleApplyView = (name: string) => {
    const target = savedViews.find((item) => item.name === name);
    if (!target) {
      return;
    }

    replaceFilters(target.filters);
    message.success(`已载入筛选视图：${name}`);
  };

  const handleDeleteView = (name: string) => {
    const nextViews = savedViews.filter((item) => item.name !== name);
    setSavedViews(nextViews);
    persistSavedFilterViews(nextViews);
    message.success(`已删除筛选视图：${name}`);
  };

  return (
    <Card className="panel-card">
      <Space wrap size={16}>
        <Select
          placeholder="选择分析周期"
          style={{ width: 220 }}
          allowClear
          value={periodLabel}
          options={periods.map((item) => ({
            label: `${item.periodLabel} · ${item.periodType}`,
            value: item.periodLabel
          }))}
          onChange={(value) => setFilters({ periodLabel: value })}
        />
        <Select
          placeholder="周期类型"
          style={{ width: 160 }}
          value={periodType ?? 'all'}
          options={periodTypeOptions}
          onChange={(value) => setFilters({ periodType: value })}
        />
        <Select
          placeholder="源数据 sheet"
          style={{ width: 240 }}
          allowClear
          value={sourceSheet}
          options={sourceSheets.map((item) => ({ label: item, value: item }))}
          onChange={(value) => setFilters({ sourceSheet: value })}
        />
        <Select
          placeholder="经营标签"
          style={{ width: 180 }}
          allowClear
          value={focusTag ?? 'all'}
          options={[{ label: '全部标签', value: 'all' }, ...BUSINESS_TAGS.map((item) => ({ label: item, value: item }))]}
          onChange={(value) => setFilters({ focusTag: value })}
        />
        <Select
          placeholder="ROI 区间"
          style={{ width: 160 }}
          value={roiBucket ?? 'all'}
          options={roiBucketOptions}
          onChange={(value) => setFilters({ roiBucket: value })}
        />
        <InputNumber<number>
          placeholder="最低支付金额"
          style={{ width: 160 }}
          min={0}
          value={minPayAmount}
          onChange={(value) => setFilters({ minPayAmount: value ?? undefined })}
        />
        <InputNumber<number>
          placeholder="最低花费"
          style={{ width: 140 }}
          min={0}
          value={minAdCost}
          onChange={(value) => setFilters({ minAdCost: value ?? undefined })}
        />
        <InputNumber<number>
          placeholder="最低退款率(%)"
          style={{ width: 160 }}
          min={0}
          max={100}
          value={minRefundRate !== undefined ? minRefundRate * 100 : undefined}
          onChange={(value) => setFilters({ minRefundRate: value !== null && value !== undefined ? value / 100 : undefined })}
        />
        <Select
          placeholder="广告成交占比"
          style={{ width: 200 }}
          value={adShareBucket ?? 'all'}
          options={adShareBucketOptions}
          onChange={(value) => setFilters({ adShareBucket: value })}
        />
        <Select
          placeholder="图片状态"
          style={{ width: 160 }}
          value={imageMode ?? 'all'}
          options={imageModeOptions}
          onChange={(value) => setFilters({ imageMode: value })}
        />
        <Input.Search
          placeholder="搜索货号 / 商品名"
          allowClear
          style={{ width: 260 }}
          value={keyword}
          onChange={(event) => setFilters({ keyword: event.target.value })}
        />
        <Select
          placeholder="载入筛选视图"
          style={{ width: 220 }}
          allowClear
          value={undefined}
          options={savedViews.map((item) => ({ label: item.name, value: item.name }))}
          onChange={(value) => value && handleApplyView(value)}
        />
        <Button onClick={handleSaveCurrentView}>保存当前筛选</Button>
        <Button onClick={resetFilters}>重置全部筛选</Button>
        <Select
          placeholder="删除筛选视图"
          style={{ width: 220 }}
          allowClear
          value={undefined}
          options={savedViews.map((item) => ({ label: item.name, value: item.name }))}
          onChange={(value) => value && handleDeleteView(value)}
        />
      </Space>
    </Card>
  );
}
