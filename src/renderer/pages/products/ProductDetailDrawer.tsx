import { Drawer, Empty, Image, Space, Tag, Typography } from 'antd';
import { BaseChartCard } from '@renderer/components/BaseChartCard';
import type { ProductDetail } from '@shared/types';

interface Props {
  open: boolean;
  detail: ProductDetail | null;
  onClose: () => void;
}

export function ProductDetailDrawer({ open, detail, onClose }: Props) {
  const trendOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: detail?.trend.map((item) => item.periodLabel) ?? [] },
    yAxis: { type: 'value' },
    series: [
      { name: '支付金额', type: 'line', data: detail?.trend.map((item) => item.payAmount) ?? [] },
      { name: '花费', type: 'line', data: detail?.trend.map((item) => item.adCost) ?? [] },
      { name: '总成交金额', type: 'bar', data: detail?.trend.map((item) => item.totalGmv) ?? [] }
    ]
  };
  const structureOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { name: '发货前退款', value: detail?.refundStructure.pre ?? 0 },
          { name: '发货后退款', value: detail?.refundStructure.post ?? 0 },
          { name: '售后退款', value: detail?.refundStructure.aftersale ?? 0 }
        ]
      }
    ]
  };
  return (
    <Drawer title="商品详情" width={720} open={open} onClose={onClose}>
      {!detail?.product ? (
        <Empty description="请选择商品" />
      ) : (
        <div className="page-stack">
          <Space align="start" size={16}>
            <Image width={120} height={120} src={detail.product.imagePath || undefined} fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" />
            <div>
              <Typography.Title level={4}>{detail.product.productName}</Typography.Title>
              <Typography.Paragraph>{detail.product.productCodeNorm}</Typography.Paragraph>
              <Typography.Paragraph>
                支付金额：{detail.product.payAmount} / 花费：{detail.product.adCost} / ROI：{detail.product.roi.toFixed(2)}
              </Typography.Paragraph>
              <Space wrap>
                {detail.product.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </div>
          </Space>
          <BaseChartCard title="最近周期趋势" option={trendOption} />
          <BaseChartCard title="退款结构" option={structureOption} height={300} />
        </div>
      )}
    </Drawer>
  );
}
