import { Alert, Card, Col, Row, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { FilterBar } from '@renderer/components/FilterBar';
import { KPIStatCard } from '@renderer/components/KPIStatCard';
import { useFilterStore } from '@renderer/stores/filterStore';
import { applyProductFilters } from '@renderer/utils/productFilters';
import type { DashboardPayload, PeriodInfo, ProductTableItem } from '@shared/types';

type DatasetKey = 'trend' | 'products' | 'quadrant';

interface MetricOption {
  label: string;
  value: string;
}

interface CorrelationRow {
  key: string;
  leftMetric: string;
  rightMetric: string;
  correlation: number;
  validPairs: number;
}

const datasetOptions: Array<{ label: string; value: DatasetKey }> = [
  { label: '周期趋势', value: 'trend' },
  { label: '商品明细', value: 'products' },
  { label: '投入产出', value: 'quadrant' }
];

const metricMap: Record<DatasetKey, MetricOption[]> = {
  trend: [
    { label: '支付金额', value: 'payAmount' },
    { label: '广告花费', value: 'adCost' },
    { label: '总成交金额', value: 'totalGmv' },
    { label: '总退款金额', value: 'refundTotalAmount' },
    { label: 'ROI', value: 'roi' }
  ],
  products: [
    { label: '支付金额', value: 'payAmount' },
    { label: '广告花费', value: 'adCost' },
    { label: 'ROI', value: 'roi' },
    { label: '成功退款金额', value: 'successRefundAmount' },
    { label: '发货前退款率', value: 'refundPreRate' },
    { label: '发货后退款率', value: 'refundPostRate' },
    { label: '售后退款率', value: 'refundAftersaleRate' },
    { label: '支付件数', value: 'payQty' }
  ],
  quadrant: [
    { label: '花费', value: 'spend' },
    { label: '支付金额', value: 'payAmount' },
    { label: '气泡大小', value: 'bubbleSize' },
    { label: 'ROI', value: 'roi' }
  ]
};

function computePearson(rows: Array<Record<string, unknown>>, xKey: string, yKey: string) {
  const pairs = rows
    .map((row) => [Number(row[xKey]), Number(row[yKey])] as const)
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (pairs.length < 2) {
    return { value: 0, validPairs: pairs.length };
  }

  const xMean = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const yMean = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const xVariance = pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0);
  const yVariance = pairs.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0);
  const xDenominator = Math.sqrt(xVariance);
  const yDenominator = Math.sqrt(yVariance);

  if (!xDenominator || !yDenominator) {
    return { value: 0, validPairs: pairs.length };
  }

  return {
    value: numerator / (xDenominator * yDenominator),
    validPairs: pairs.length
  };
}

function getCorrelationLevel(value: number) {
  const absValue = Math.abs(value);
  if (absValue >= 0.8) return '强相关';
  if (absValue >= 0.5) return '中度相关';
  if (absValue >= 0.3) return '弱相关';
  return '低相关';
}

export function CorrelationsPage() {
  const filters = useFilterStore();
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [sourceSheets, setSourceSheets] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [products, setProducts] = useState<ProductTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [datasetKey, setDatasetKey] = useState<DatasetKey>('products');
  const [selectedPairKey, setSelectedPairKey] = useState('');

  useEffect(() => {
    window.ecomApi.analytics.getFilters().then((result) => {
      setPeriods(result.periods);
      setSourceSheets(result.sourceSheets);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([window.ecomApi.analytics.getDashboard(filters), window.ecomApi.analytics.getProducts(filters)])
      .then(([dashboardPayload, productRows]) => {
        setDashboard(dashboardPayload);
        setProducts(productRows);
      })
      .finally(() => setLoading(false));
  }, [filters.keyword, filters.periodLabel, filters.periodType, filters.sourceSheet]);

  const metrics = metricMap[datasetKey];
  const filteredProducts = useMemo(() => applyProductFilters(products, filters), [filters, products]);

  const rows = useMemo<Array<Record<string, unknown>>>(() => {
    if (datasetKey === 'trend') {
      return dashboard?.trend.map((item) => ({ ...item })) ?? [];
    }

    if (datasetKey === 'products') {
      return filteredProducts.map((item) => ({ ...item }));
    }

    return filteredProducts.map((item) => ({
      spend: item.adCost,
      payAmount: item.payAmount,
      bubbleSize: item.payQty,
      roi: item.roi,
      productName: item.productName
    }));
  }, [dashboard, datasetKey, filteredProducts]);

  const pairRows = useMemo<CorrelationRow[]>(() => {
    const output: CorrelationRow[] = [];
    for (let i = 0; i < metrics.length; i += 1) {
      for (let j = i + 1; j < metrics.length; j += 1) {
        const left = metrics[i];
        const right = metrics[j];
        const result = computePearson(rows, left.value, right.value);
        output.push({
          key: `${left.value}-${right.value}`,
          leftMetric: left.label,
          rightMetric: right.label,
          correlation: result.value,
          validPairs: result.validPairs
        });
      }
    }
    return output.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [metrics, rows]);

  useEffect(() => {
    setSelectedPairKey(pairRows[0]?.key || '');
  }, [pairRows]);

  const selectedPair = pairRows.find((item) => item.key === selectedPairKey) || pairRows[0];
  const selectedMetricKeys = selectedPair
    ? {
        x: metrics.find((item) => item.label === selectedPair.leftMetric)?.value || metrics[0]?.value,
        y: metrics.find((item) => item.label === selectedPair.rightMetric)?.value || metrics[1]?.value
      }
    : null;

  const scatterOption = {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', name: selectedPair?.leftMetric || 'X 指标' },
    yAxis: { type: 'value', name: selectedPair?.rightMetric || 'Y 指标' },
    series: [
      {
        type: 'scatter',
        itemStyle: { color: '#1677ff' },
        symbolSize: 18,
        data: selectedMetricKeys
          ? rows.map((row) => [Number(row[selectedMetricKeys.x] ?? 0), Number(row[selectedMetricKeys.y] ?? 0), row.productName || row.periodLabel || ''])
          : []
      }
    ]
  };

  const matrixColumns: ColumnsType<Record<string, unknown>> = [
    { title: '指标', dataIndex: 'metric', key: 'metric', fixed: 'left', width: 120 },
    ...metrics.map((metric) => ({
      title: metric.label,
      dataIndex: metric.value,
      key: metric.value,
      width: 130,
      render: (value: number | '-') => (value === '-' ? '-' : `${value.toFixed(2)} (${getCorrelationLevel(value)})`)
    }))
  ];

  const matrixData = metrics.map((rowMetric) => {
    const row: Record<string, unknown> = { key: rowMetric.value, metric: rowMetric.label };
    metrics.forEach((colMetric) => {
      row[colMetric.value] = rowMetric.value === colMetric.value ? 1 : computePearson(rows, rowMetric.value, colMetric.value).value;
    });
    return row;
  });

  const strongestPositive = pairRows.filter((item) => item.correlation >= 0).sort((a, b) => b.correlation - a.correlation)[0];
  const strongestNegative = pairRows.filter((item) => item.correlation < 0).sort((a, b) => a.correlation - b.correlation)[0];
  const avgAbsCorrelation = pairRows.length ? pairRows.reduce((sum, item) => sum + Math.abs(item.correlation), 0) / pairRows.length : 0;
  const hasInsufficientData = rows.length < 3 || pairRows.some((item) => item.validPairs < 3);

  return (
    <div className="page-stack">
      <FilterBar periods={periods} sourceSheets={sourceSheets} />

      <Alert
        type="success"
        showIcon
        message={`当前分析范围：${filters.sourceSheet || '全部源 sheet'}`}
        description={`当前数据源是 ${datasetOptions.find((item) => item.value === datasetKey)?.label || '商品明细'}，参与相关性计算的样本数为 ${rows.length}。如果切到商品明细或投入产出，顶部二次筛选会直接作用于相关性结果。`}
      />

      <Space>
        <Typography.Text strong>分析数据源</Typography.Text>
        <Select value={datasetKey} options={datasetOptions} style={{ width: 180 }} onChange={(value) => setDatasetKey(value as DatasetKey)} />
        <Typography.Text type="secondary">当前样本数：{rows.length}</Typography.Text>
      </Space>

      {hasInsufficientData ? (
        <Alert
          type="warning"
          showIcon
          message="当前相关性结果参考价值有限"
          description="常见原因是样本数太少，或某些指标在当前筛选条件下几乎没有波动。建议切到商品明细，或放宽顶部的标签、ROI 和金额筛选。"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <KPIStatCard
            title="最强正相关"
            value={strongestPositive?.correlation ?? 0}
            precision={3}
            suffix={strongestPositive ? `${strongestPositive.leftMetric} / ${strongestPositive.rightMetric}` : ''}
          />
        </Col>
        <Col span={8}>
          <KPIStatCard
            title="最强负相关"
            value={strongestNegative?.correlation ?? 0}
            precision={3}
            suffix={strongestNegative ? `${strongestNegative.leftMetric} / ${strongestNegative.rightMetric}` : ''}
          />
        </Col>
        <Col span={8}>
          <KPIStatCard title="平均绝对相关性" value={avgAbsCorrelation} precision={3} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="panel-card" title="相关矩阵">
            <Table size="small" pagination={false} columns={matrixColumns} dataSource={matrixData} scroll={{ x: 980 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card className="panel-card" title="相关性排行">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                value={selectedPairKey}
                style={{ width: '100%' }}
                options={pairRows.map((item) => ({
                  label: `${item.leftMetric} × ${item.rightMetric} (${item.correlation.toFixed(3)})`,
                  value: item.key
                }))}
                onChange={setSelectedPairKey}
              />
              <Table
                size="small"
                pagination={{ pageSize: 8 }}
                columns={[
                  { title: '指标 A', dataIndex: 'leftMetric', key: 'leftMetric' },
                  { title: '指标 B', dataIndex: 'rightMetric', key: 'rightMetric' },
                  { title: '样本数', dataIndex: 'validPairs', key: 'validPairs' },
                  { title: '相关系数', dataIndex: 'correlation', key: 'correlation', render: (value: number) => `${value.toFixed(3)} (${getCorrelationLevel(value)})` }
                ]}
                dataSource={pairRows}
                onRow={(record) => ({
                  onClick: () => setSelectedPairKey(record.key)
                })}
              />
            </Space>
          </Card>
        </Col>
        <Col span={14}>
          <BaseChartCard title={`散点分析：${selectedPair?.leftMetric || '-'} vs ${selectedPair?.rightMetric || '-'}`} loading={loading} option={scatterOption} height={420} />
        </Col>
      </Row>
    </div>
  );
}
