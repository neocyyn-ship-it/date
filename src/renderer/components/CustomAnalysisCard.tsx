import { Button, Card, Empty, Input, Popconfirm, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { DashboardPayload } from '@shared/types';
import { BaseChartCard } from './BaseChartCard';
import {
  buildChartOption,
  chartOptions,
  computePearson,
  datasetMetricMap,
  datasetOptions,
  formatValue,
  getCorrelationLabel,
  getRows,
  loadSavedViews,
  persistSavedViews,
  type ChartType,
  type DatasetKey,
  type SavedView
} from './customAnalysisUtils';

interface Props {
  data: DashboardPayload | null;
  loading?: boolean;
}

export function CustomAnalysisCard({ data, loading }: Props) {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>('trend');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xField, setXField] = useState('periodLabel');
  const [yField, setYField] = useState('payAmount');
  const [bubbleField, setBubbleField] = useState('totalGmv');
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);

  const metricOptions = datasetMetricMap[datasetKey];
  const rows = useMemo(() => getRows(data, datasetKey), [data, datasetKey]);
  const numericOptions = metricOptions.filter((item) => item.type === 'number');
  const xMeta = metricOptions.find((item) => item.value === xField) || metricOptions[0];
  const yMeta = metricOptions.find((item) => item.value === yField) || numericOptions[0];

  const applyDatasetDefaults = (nextDataset: DatasetKey) => {
    const nextMetrics = datasetMetricMap[nextDataset];
    const firstString = nextMetrics.find((item) => item.type === 'string')?.value || nextMetrics[0].value;
    const firstNumber = nextMetrics.find((item) => item.type === 'number')?.value || nextMetrics[0].value;
    const secondNumber = nextMetrics.filter((item) => item.type === 'number')[1]?.value || firstNumber;
    setDatasetKey(nextDataset);
    setXField(firstString);
    setYField(firstNumber);
    setBubbleField(secondNumber);
  };

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) {
      message.warning('请先输入视图名称。');
      return;
    }

    const nextViews = [
      {
        id: `${Date.now()}`,
        name,
        datasetKey,
        chartType,
        xField,
        yField,
        bubbleField,
        createdAt: new Date().toISOString()
      },
      ...savedViews
    ];
    setSavedViews(nextViews);
    persistSavedViews(nextViews);
    setViewName('');
    message.success('自定义视图已保存，首页拼板会自动同步。');
  };

  const applySavedView = (viewId: string) => {
    const target = savedViews.find((item) => item.id === viewId);
    if (!target) {
      return;
    }

    setDatasetKey(target.datasetKey);
    setChartType(target.chartType);
    setXField(target.xField);
    setYField(target.yField);
    setBubbleField(target.bubbleField);
    setViewName(target.name);
    message.success(`已载入视图：${target.name}`);
  };

  const removeSavedView = (viewId: string) => {
    const nextViews = savedViews.filter((item) => item.id !== viewId);
    setSavedViews(nextViews);
    persistSavedViews(nextViews);
    message.success('已删除视图。');
  };

  const chartOption = useMemo(
    () => buildChartOption(rows, chartType, xField, yField, bubbleField, xMeta?.label, yMeta?.label),
    [bubbleField, chartType, rows, xField, xMeta?.label, yField, yMeta?.label]
  );

  const correlation = useMemo(() => {
    if (xMeta?.type !== 'number' || yMeta?.type !== 'number') {
      return null;
    }
    return computePearson(rows, xField, yField);
  }, [rows, xField, xMeta?.type, yField, yMeta?.type]);

  const tableColumns = useMemo<ColumnsType<Record<string, unknown>>>(() => {
    return metricOptions.map((item) => ({
      title: item.label,
      dataIndex: item.value,
      key: item.value,
      render: (value: unknown) => formatValue(value)
    }));
  }, [metricOptions]);

  return (
    <Card
      className="panel-card"
      title="自定义分析"
      extra={
        <Space wrap>
          <Select value={datasetKey} options={datasetOptions} style={{ width: 160 }} onChange={(value) => applyDatasetDefaults(value as DatasetKey)} />
          <Select value={chartType} options={chartOptions} style={{ width: 120 }} onChange={(value) => setChartType(value as ChartType)} />
          <Select
            value={xField}
            options={(chartType === 'scatter' || chartType === 'bubble' ? numericOptions : metricOptions).map((item) => ({
              label: item.label,
              value: item.value
            }))}
            style={{ width: 140 }}
            onChange={setXField}
          />
          <Select
            value={yField}
            options={numericOptions.map((item) => ({ label: item.label, value: item.value }))}
            style={{ width: 140 }}
            onChange={setYField}
          />
          {chartType === 'bubble' ? (
            <Select
              value={bubbleField}
              options={numericOptions.map((item) => ({ label: item.label, value: item.value }))}
              style={{ width: 140 }}
              onChange={setBubbleField}
            />
          ) : null}
        </Space>
      }
    >
      <Space size={16} style={{ width: '100%', marginBottom: 16 }} wrap>
        <Card size="small" style={{ minWidth: 180 }}>
          <Statistic title="当前数据条数" value={rows.length} />
        </Card>
        <Card size="small" style={{ minWidth: 220 }}>
          <Statistic
            title="X / Y 相关性"
            value={correlation === null ? '-' : correlation}
            precision={3}
            suffix={correlation === null ? '' : `(${getCorrelationLabel(correlation)})`}
          />
        </Card>
        <Card size="small" style={{ minWidth: 240 }}>
          <Typography.Text type="secondary">
            当前字段：X 轴为“{xMeta?.label}”，Y 轴为“{yMeta?.label}”
          </Typography.Text>
        </Card>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }} title="视图保存" extra={<Tag color="blue">保存在本机</Tag>}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Input placeholder="例如：老板周会 ROI 气泡图" style={{ width: 280 }} value={viewName} onChange={(event) => setViewName(event.target.value)} />
            <Button type="primary" onClick={saveCurrentView}>
              保存当前视图
            </Button>
          </Space>

          {!savedViews.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有保存过自定义视图" />
          ) : (
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={savedViews}
              columns={[
                { title: '视图名称', dataIndex: 'name', key: 'name' },
                {
                  title: '数据源',
                  dataIndex: 'datasetKey',
                  key: 'datasetKey',
                  render: (value: DatasetKey) => datasetOptions.find((item) => item.value === value)?.label || value
                },
                {
                  title: '图表类型',
                  dataIndex: 'chartType',
                  key: 'chartType',
                  render: (value: ChartType) => chartOptions.find((item) => item.value === value)?.label || value
                },
                {
                  title: '操作',
                  key: 'actions',
                  render: (_value, record: SavedView) => (
                    <Space>
                      <Button type="link" onClick={() => applySavedView(record.id)}>
                        载入
                      </Button>
                      <Popconfirm title="确认删除这个视图吗？" onConfirm={() => removeSavedView(record.id)}>
                        <Button type="link" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          )}
        </Space>
      </Card>

      {chartType === 'table' ? (
        <Table
          rowKey={(_row, index) => `${datasetKey}-${index}`}
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={rows}
          columns={tableColumns}
          scroll={{ x: 960 }}
        />
      ) : (
        <BaseChartCard title="分析结果" loading={loading} option={chartOption} height={380} />
      )}
    </Card>
  );
}
