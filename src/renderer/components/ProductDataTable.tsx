import { Image, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TAG_COLORS } from '@shared/constants/business';
import type { ProductTableItem } from '@shared/types';

interface Props {
  data: ProductTableItem[];
  onRowClick?: (row: ProductTableItem) => void;
}

export function ProductDataTable({ data, onRowClick }: Props) {
  const columns: ColumnsType<ProductTableItem> = [
    {
      title: '商品',
      key: 'product',
      width: 280,
      render: (_, row) => (
        <Space>
          <Image width={56} height={56} src={row.imagePath || undefined} fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" />
          <div>
            <div>{row.productCodeNorm || row.productId}</div>
            <div style={{ color: '#64748b' }}>{row.productName}</div>
          </div>
        </Space>
      )
    },
    { title: '支付金额', dataIndex: 'payAmount', sorter: (a, b) => a.payAmount - b.payAmount },
    { title: '花费', dataIndex: 'adCost', sorter: (a, b) => a.adCost - b.adCost },
    { title: 'ROI', dataIndex: 'roi', sorter: (a, b) => a.roi - b.roi },
    { title: '成功退款金额', dataIndex: 'successRefundAmount' },
    { title: '发货前退款率', dataIndex: 'refundPreRate', render: (value) => `${(value * 100).toFixed(2)}%` },
    { title: '发货后退款率', dataIndex: 'refundPostRate', render: (value) => `${(value * 100).toFixed(2)}%` },
    { title: '售后退款率', dataIndex: 'refundAftersaleRate', render: (value) => `${(value * 100).toFixed(2)}%` },
    { title: '环比', dataIndex: 'momChange', render: (value) => (value === null ? '--' : `${(value * 100).toFixed(2)}%`) },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) => tags.map((tag) => <Tag key={tag} color={TAG_COLORS[tag]}>{tag}</Tag>)
    }
  ];
  return (
    <Table
      className="panel-card"
      rowKey={(record) => `${record.productCodeNorm}-${record.productId}`}
      columns={columns}
      dataSource={data}
      scroll={{ x: 1380 }}
      pagination={{ pageSize: 12 }}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record)
      })}
    />
  );
}
