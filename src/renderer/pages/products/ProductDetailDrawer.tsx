import { Descriptions, Drawer, Empty, Image, Space, Tag, Typography } from 'antd';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import { TAG_COLORS } from '@shared/constants/business';
import type { ProductDetail } from '@shared/types';

interface Props {
  open: boolean;
  detail: ProductDetail | null;
  onClose: () => void;
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  });
}

function formatPercent(value: number) {
  return `${((value || 0) * 100).toFixed(2)}%`;
}

export function ProductDetailDrawer({ open, detail, onClose }: Props) {
  const product = detail?.product;

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: detail?.trend.map((item) => item.periodLabel) ?? [] },
    yAxis: [{ type: 'value' }, { type: 'value' }],
    series: [
      { name: '生参支付金额', type: 'line', smooth: true, data: detail?.trend.map((item) => item.payAmount) ?? [] },
      { name: '阿里妈妈花费', type: 'line', smooth: true, data: detail?.trend.map((item) => item.adCost) ?? [] },
      { name: '阿里妈妈成交金额', type: 'bar', yAxisIndex: 1, data: detail?.trend.map((item) => item.totalGmv) ?? [] }
    ]
  };

  const structureOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        data: [
          { name: '发货前退款', value: detail?.refundStructure.pre ?? 0 },
          { name: '发货后退款', value: detail?.refundStructure.post ?? 0 },
          { name: '售后退款', value: detail?.refundStructure.aftersale ?? 0 }
        ]
      }
    ]
  };

  return (
    <Drawer title="商品详情" width={760} open={open} onClose={onClose}>
      {!product ? (
        <Empty description="请选择商品" />
      ) : (
        <div className="page-stack">
          <Space align="start" size={16}>
            <Image
              width={132}
              height={132}
              src={product.imagePath || undefined}
              fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            />
            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {product.productName}
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 8 }}>货号：{product.productCodeNorm || '-'}</Typography.Paragraph>
              <Space wrap>
                {product.tags.map((tag) => (
                  <Tag key={tag} color={TAG_COLORS[tag] || 'default'}>
                    {tag}
                  </Tag>
                ))}
              </Space>
            </div>
          </Space>

          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="生参支付金额">{formatAmount(product.payAmount)}</Descriptions.Item>
            <Descriptions.Item label="阿里妈妈花费">{formatAmount(product.adCost)}</Descriptions.Item>
            <Descriptions.Item label="阿里妈妈投产比">{product.roi.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="广告成交占比">{formatPercent(product.adAttributedShare)}</Descriptions.Item>
            <Descriptions.Item label="广告成交金额">{formatAmount(product.totalGmv)}</Descriptions.Item>
            <Descriptions.Item label="支付环比">{product.momChange === null ? '--' : formatPercent(product.momChange)}</Descriptions.Item>
          </Descriptions>

          <BaseChartCard title="最近周期趋势" option={trendOption} />
          <BaseChartCard title="退款结构" option={structureOption} height={320} />
        </div>
      )}
    </Drawer>
  );
}
