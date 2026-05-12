import type { DashboardPayload } from '@shared/types';

export type DatasetKey = 'trend' | 'ranking' | 'quadrant';
export type ChartType = 'line' | 'bar' | 'scatter' | 'bubble' | 'table';

export interface MetricOption {
  label: string;
  value: string;
  type: 'string' | 'number';
}

export interface SavedView {
  id: string;
  name: string;
  datasetKey: DatasetKey;
  chartType: ChartType;
  xField: string;
  yField: string;
  bubbleField: string;
  createdAt: string;
}

export const CUSTOM_ANALYSIS_STORAGE_KEY = 'ecom-analytics:custom-analysis-views';

export const datasetOptions: Array<{ label: string; value: DatasetKey }> = [
  { label: '周期趋势数据', value: 'trend' },
  { label: '商品排行数据', value: 'ranking' },
  { label: '投入产出数据', value: 'quadrant' }
];

export const chartOptions: Array<{ label: string; value: ChartType }> = [
  { label: '折线图', value: 'line' },
  { label: '柱状图', value: 'bar' },
  { label: '散点图', value: 'scatter' },
  { label: '气泡图', value: 'bubble' },
  { label: '明细表', value: 'table' }
];

export const datasetMetricMap: Record<DatasetKey, MetricOption[]> = {
  trend: [
    { label: '周期', value: 'periodLabel', type: 'string' },
    { label: '支付金额', value: 'payAmount', type: 'number' },
    { label: '阿里妈妈花费', value: 'adCost', type: 'number' },
    { label: '广告成交金额', value: 'totalGmv', type: 'number' },
    { label: '总退款金额', value: 'refundTotalAmount', type: 'number' },
    { label: '投产比', value: 'roi', type: 'number' }
  ],
  ranking: [
    { label: '商品名称', value: 'productName', type: 'string' },
    { label: '支付金额', value: 'payAmount', type: 'number' },
    { label: '阿里妈妈花费', value: 'adCost', type: 'number' },
    { label: '广告成交金额', value: 'totalGmv', type: 'number' },
    { label: '投产比', value: 'roi', type: 'number' },
    { label: '支付件数', value: 'payQty', type: 'number' }
  ],
  quadrant: [
    { label: '商品名称', value: 'productName', type: 'string' },
    { label: '花费', value: 'spend', type: 'number' },
    { label: '支付金额', value: 'payAmount', type: 'number' },
    { label: '气泡大小', value: 'bubbleSize', type: 'number' },
    { label: '投产比', value: 'roi', type: 'number' }
  ]
};

export function loadSavedViews() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_ANALYSIS_STORAGE_KEY);
    if (!raw) return [] as SavedView[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function persistSavedViews(views: SavedView[]) {
  window.localStorage.setItem(CUSTOM_ANALYSIS_STORAGE_KEY, JSON.stringify(views));
}

export function getRows(data: DashboardPayload | null, datasetKey: DatasetKey) {
  if (!data) return [] as Array<Record<string, unknown>>;
  if (datasetKey === 'trend') return data.trend.map((item) => ({ ...item }));
  if (datasetKey === 'ranking') return data.ranking.map((item) => ({ ...item }));
  return data.quadrant.map((item) => ({ ...item }));
}

export function formatValue(value: unknown) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value ?? '-');
}

export function getCorrelationLabel(value: number | null) {
  if (value === null) return '无法计算';
  const absValue = Math.abs(value);
  if (absValue >= 0.8) return '强相关';
  if (absValue >= 0.5) return '中度相关';
  if (absValue >= 0.3) return '弱相关';
  return '几乎无相关';
}

export function computePearson(rows: Array<Record<string, unknown>>, xKey: string, yKey: string) {
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

export function buildChartOption(
  rows: Array<Record<string, unknown>>,
  chartType: ChartType,
  xField: string,
  yField: string,
  bubbleField: string,
  xLabel?: string,
  yLabel?: string
) {
  if (!rows.length || chartType === 'table') {
    return { series: [] };
  }

  if (chartType === 'line' || chartType === 'bar') {
    const categories = rows.map((row) => String(row[xField] ?? '-'));
    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: categories, axisLabel: { rotate: categories.length > 8 ? 25 : 0 } },
      yAxis: { type: 'value', name: yLabel || '数值' },
      series: [
        {
          name: yLabel || yField,
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
    xAxis: { type: 'value', name: xLabel || xField },
    yAxis: { type: 'value', name: yLabel || yField },
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
}
