import { Button, Card, Empty, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import type { DashboardPayload } from '@shared/types';
import { BaseChartCard } from './BaseChartCard';
import {
  buildChartOption,
  chartOptions,
  datasetMetricMap,
  datasetOptions,
  getRows,
  loadSavedViews,
  persistSavedViews,
  type SavedView
} from './customAnalysisUtils';

interface Props {
  data: DashboardPayload | null;
  loading?: boolean;
}

export function SavedViewBoard({ data, loading }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setViews(loadSavedViews());
  }, [data]);

  const updateViews = (nextViews: SavedView[], successMessage: string) => {
    setViews(nextViews);
    persistSavedViews(nextViews);
    message.success(successMessage);
  };

  const moveView = (viewId: string, direction: 'up' | 'down') => {
    const index = views.findIndex((item) => item.id === viewId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= views.length) return;
    const nextViews = [...views];
    const [current] = nextViews.splice(index, 1);
    nextViews.splice(targetIndex, 0, current);
    updateViews(nextViews, direction === 'up' ? '视图已上移。' : '视图已下移。');
  };

  const pinToTop = (viewId: string) => {
    const target = views.find((item) => item.id === viewId);
    if (!target) return;
    const nextViews = [target, ...views.filter((item) => item.id !== viewId)];
    updateViews(nextViews, '视图已置顶。');
  };

  const removeView = (viewId: string) => {
    const nextViews = views.filter((item) => item.id !== viewId);
    updateViews(nextViews, '视图已从首页拼板移除。');
  };

  if (!views.length) {
    return (
      <Card className="panel-card" title="首页拼板">
        <Empty description="还没有已保存的自定义视图。先在下方自定义分析里保存一个视图，首页就会自动生成拼板。" />
      </Card>
    );
  }

  return (
    <Card className="panel-card" title="首页拼板" extra={<Tag color="blue">自动读取已保存视图</Tag>}>
      <div className="saved-view-grid">
        {views.map((view, index) => {
          const rows = getRows(data, view.datasetKey);
          const metricOptions = datasetMetricMap[view.datasetKey];
          const xMeta = metricOptions.find((item) => item.value === view.xField);
          const yMeta = metricOptions.find((item) => item.value === view.yField);
          const option = buildChartOption(rows, view.chartType, view.xField, view.yField, view.bubbleField, xMeta?.label, yMeta?.label);

          return (
            <Card
              key={view.id}
              size="small"
              className="saved-view-item"
              title={view.name}
              extra={
                <Space size={8}>
                  {index === 0 ? <Tag color="gold">置顶</Tag> : null}
                  <Tag>{datasetOptions.find((item) => item.value === view.datasetKey)?.label || view.datasetKey}</Tag>
                  <Tag color="purple">{chartOptions.find((item) => item.value === view.chartType)?.label || view.chartType}</Tag>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                  <Typography.Text type="secondary">
                    X 轴：{xMeta?.label || view.xField} / Y 轴：{yMeta?.label || view.yField}
                  </Typography.Text>
                  <Space size={4}>
                    <Button size="small" onClick={() => pinToTop(view.id)} disabled={index === 0}>
                      置顶
                    </Button>
                    <Button size="small" onClick={() => moveView(view.id, 'up')} disabled={index === 0}>
                      上移
                    </Button>
                    <Button size="small" onClick={() => moveView(view.id, 'down')} disabled={index === views.length - 1}>
                      下移
                    </Button>
                    <Popconfirm title="确认从首页拼板删除这个视图吗？" onConfirm={() => removeView(view.id)}>
                      <Button size="small" danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </Space>
                <BaseChartCard title="视图预览" loading={loading} option={option} height={260} />
              </Space>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}
