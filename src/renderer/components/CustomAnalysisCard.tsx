import { Button, Card, Empty, Input, Popconfirm, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { DashboardPayload } from '@shared/types';
import { BaseChartCard } from './BaseChartCard';

type DatasetKey = 'trend' | 'ranking' | 'quadrant';
type ChartType = 'line' | 'bar' | 'scatter' | 'bubble' | 'table';

interface MetricOption {
  label: string;
  value: string;
  type: 'string' | 'number';
}

interface SavedView {
  id: string;
  name: string;
  datasetKey: DatasetKey;
  chartType: ChartType;
  xField: string;
  yField: string;
  bubbleField: string;
  createdAt: string;
}

interface Props {
  data: DashboardPayload | null;
  loading?: boolean;
}

const STORAGE_KEY = 'ecom-analytics:custom-analysis-views';

const datasetOptions: Array<{ label: string; value: DatasetKey }> = [
  { label: '周期趋势数据', value: 'trend' },
  { label: '商品排行数据', value: 'ranking' },
  { label: '投入产出数据', value: 'quadrant' }
];

const datasetMetricMap: Record<DatasetKey, MetricOption[]> = {
  trend: [
    { label: '周期', value: 'periodLabel', type: 'string' },
    { label: '支付金额', value: 'payAmount', type: 'number' },
    { label: '广告花费', value: 'adCost', type: 'number' },
    { label: '总成交金额', value: 'totalGmv', type: 'number' },
    { label: '总退款金额', value: 'refundTotalAmount', type: 'number' },
    { label: 'ROI', value: 'roi', type: 'number' }
  ],
  ranking: [
    { label: '商品名称', value: 'productName', type: 'string' },
    { label: '支付金额', value: 'payAmount', type: 'number' },
    { label: '广告花费', value: 'adCost', type: 'number' },
    { label: '总成交金额', value: 'totalGmv', type: 'number' },
    { label: 'ROI', value: 'roi', type: 'number' },
    { label: '支付件数', value: 'payQty', type: 'number' }
  ],
  quadrant: [
    { label: '商品名称', value: 'productName', type: 'string' },
    { label: '花费', value: 'spend', type: 'number' },
    { label: '支付金额', value: 'payAmount', type: 'number' },
    { label: '气泡大小', value: 'bubbleSize', type: 'number' },
    { label: 'ROI', value: 'roi', type: 'number' }
  ]
};

const chartOptions: Array<{ label: string; value: ChartType }> = [
  { label: '折线图', value: 'line' },
  { label: '柱状图', value: 'bar' },
  { label: '散点图', value: 'scatter' },
  { label: '气泡图', value: 'bubble' },
  { label: '明细表', value: 'table' }
];

function loadSavedViews() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [] as SavedView[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedView[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

function formatValue(value: unknown) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value ?? '-');
}

function getCorrelationLabel(value: number | null) {
  if (value === null) return '无法计算';
  const absValue = Math.abs(value);
  if (absValue >= 0.8) return '强相关';
  if (absValue >= 0.5) return '中度相关';
  if (absValue >= 0.3) return '弱相关';
  return '几乎无相关';
}

function computePearson(rows: Array<Record<string, unknown>>, xKey: string, yKey: string) {
  const pairs = rows
    .map((row) => [Number(row[xKey]), Number(row[yKey])] as const)
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (pairs.length < 2) return null;

  const xMean = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const yMean = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const xDenominator = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0));
  const yDenominator = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0));

  if (!xDenominator || !yDenominator) return null;
  return numerator / (xDenominator * yDenominator);
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
  const rows = useMemo<Array<Record<string, unknown>>>(() => {
    if (!data) return [];
    if (datasetKey === 'trend') return data.trend.map((item) => ({ ...item }));
    if (datasetKey === 'ranking') return data.ranking.map((item) => ({ ...item }));
    return data.quadrant.map((item) => ({ ...item }));
  }, [data, datasetKey]);

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
    message.success('自定义视图已保存。');
  };

  const applySavedView = (viewId: string) => {
    const target = savedViews.find((item) => item.id === viewId);
    if (!target) return;
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

  const chartOption = useMemo(() => {
    if (!rows.length || chartType === 'table') {
      return { series: [] };
    }

    if (chartType === 'line' || chartType === 'bar') {
      const categories = rows.map((row) => String(row[xField] ?? '-'));
      return {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: categories, axisLabel: { rotate: categories.length > 8 ? 25 : 0 } },
        yAxis: { type: 'value', name: yMeta?.label || '数值' },
        series: [
          {
            name: yMeta?.label || yField,
            type: chartType,
            smooth: chartType === 'line',
            data: rows.map((row) => Number(row[yField] ?? 0)),
            itemStyle: { color: chartType === 'line' ? '#1677ff' : '#0f766e' }
          }
        ]
      };
    }

    const visualMax = Math.max(...rows.map((row) => Number(row[yField] ?? 0)), 1);
    return {
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', name: xMeta?.label || xField },
      yAxis: { type: 'value', name: yMeta?.label || yField },
      visualMap: {
        show: true,
        min: 0,
        max: visualMax,
        dimension: chartType === 'bubble' ? 3 : 2,
        right: 12,
        top: 12
      },
      series: [
        {
          type: 'scatter',
          symbolSize: (value: number[]) => {
            if (chartType !== 'bubble') return 16;
            return Math.max(14, Math.min(48, Number(value[2] || 0) / 2));
          },
          data: rows.map((row) => {
            const xValue = Number(row[xField] ?? 0);
            const yValue = Number(row[yField] ?? 0);
            const bubbleValue = Number(row[bubbleField] ?? 0);
            return chartType === 'bubble'
              ? [xValue, yValue, bubbleValue, yValue, row.productName || row.periodLabel || '']
              : [xValue, yValue, yValue, row.productName || row.periodLabel || ''];
          })
        }
      ]
    };
  }, [bubbleField, chartType, rows, xField, xMeta?.label, yField, yMeta?.label]);

  const correlation = useMemo(() => {
    if (xMeta?.type !== 'number' || yMeta?.type !== 'number') return null;
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
          <Select
            value={datasetKey}
            options={datasetOptions}
            style={{ width: 160 }}
            onChange={(value) => applyDatasetDefaults(value as DatasetKey)}
          />
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
            当前字段：X 轴为「{xMeta?.label}」，Y 轴为「{yMeta?.label}」
          </Typography.Text>
        </Card>
      </Space>

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title="视图保存"
        extra={<Tag color="blue">保存在本机</Tag>}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Input
              placeholder="例如：老板周会 ROI 气泡图"
              style={{ width: 280 }}
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
            <Button type="primary" onClick={saveCurrentView}>保存当前视图</Button>
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
                      <Button type="link" onClick={() => applySavedView(record.id)}>载入</Button>
                      <Popconfirm title="确认删除这个视图吗？" onConfirm={() => removeSavedView(record.id)}>
                        <Button type="link" danger>删除</Button>
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
