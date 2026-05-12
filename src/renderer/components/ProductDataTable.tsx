import { Image, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TAG_COLORS } from '@shared/constants/business';
import type { ProductTableItem } from '@shared/types';
import type { ProductColumnKey } from '@renderer/utils/productColumns';

interface Props {
  data: ProductTableItem[];
  visibleColumns?: ProductColumnKey[];
  onRowClick?: (row: ProductTableItem) => void;
  paginationSize?: number;
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  });
}

function formatPercent(value: number) {
  return `${((value || 0) * 100).toFixed(2)}%`;
}

export function ProductDataTable({ data, visibleColumns, onRowClick, paginationSize = 12 }: Props) {
  const columns: ColumnsType<ProductTableItem> = [
    {
      title: '商品',
      key: 'product',
      width: 320,
      fixed: 'left',
      hidden: visibleColumns ? !visibleColumns.includes('product') : false,
      render: (_, row) => (
        <Space align="start">
          <Image
            width={64}
            height={64}
            src={row.imagePath || undefined}
            fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            preview={false}
          />
          <div>
            <Typography.Text strong>{row.productCodeNorm || row.productId || '-'}</Typography.Text>
            <div style={{ color: '#64748b', marginTop: 4 }}>{row.productName || '-'}</div>
          </div>
        </Space>
      )
    },
    {
      title: '生参支付金额',
      dataIndex: 'payAmount',
      hidden: visibleColumns ? !visibleColumns.includes('payAmount') : false,
      sorter: (left, right) => left.payAmount - right.payAmount,
      render: (value: number) => formatAmount(value)
    },
    {
      title: '阿里妈妈花费',
      dataIndex: 'adCost',
      hidden: visibleColumns ? !visibleColumns.includes('adCost') : false,
      sorter: (left, right) => left.adCost - right.adCost,
      render: (value: number) => formatAmount(value)
    },
    {
      title: '阿里妈妈投产比',
      dataIndex: 'roi',
      hidden: visibleColumns ? !visibleColumns.includes('roi') : false,
      sorter: (left, right) => left.roi - right.roi,
      render: (value: number) => Number(value || 0).toFixed(2)
    },
    {
      title: '广告成交占比',
      dataIndex: 'adAttributedShare',
      hidden: visibleColumns ? !visibleColumns.includes('adAttributedShare') : false,
      sorter: (left, right) => left.adAttributedShare - right.adAttributedShare,
      render: (value: number) => formatPercent(value)
    },
    {
      title: '广告成交金额',
      dataIndex: 'totalGmv',
      hidden: visibleColumns ? !visibleColumns.includes('totalGmv') : false,
      sorter: (left, right) => left.totalGmv - right.totalGmv,
      render: (value: number) => formatAmount(value)
    },
    {
      title: '成功退款金额',
      dataIndex: 'successRefundAmount',
      hidden: visibleColumns ? !visibleColumns.includes('successRefundAmount') : false,
      render: (value: number) => formatAmount(value)
    },
    {
      title: '发货前退款率',
      dataIndex: 'refundPreRate',
      hidden: visibleColumns ? !visibleColumns.includes('refundPreRate') : false,
      render: (value: number) => formatPercent(value)
    },
    {
      title: '发货后退款率',
      dataIndex: 'refundPostRate',
      hidden: visibleColumns ? !visibleColumns.includes('refundPostRate') : false,
      render: (value: number) => formatPercent(value)
    },
    {
      title: '售后退款率',
      dataIndex: 'refundAftersaleRate',
      hidden: visibleColumns ? !visibleColumns.includes('refundAftersaleRate') : false,
      render: (value: number) => formatPercent(value)
    },
    {
      title: '支付环比',
      dataIndex: 'momChange',
      hidden: visibleColumns ? !visibleColumns.includes('momChange') : false,
      render: (value: number | null) => (value === null ? '--' : formatPercent(value))
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 220,
      hidden: visibleColumns ? !visibleColumns.includes('tags') : false,
      render: (tags: string[] = []) =>
        tags.map((tag) => (
          <Tag key={tag} color={TAG_COLORS[tag] || 'default'}>
            {tag}
          </Tag>
        ))
    }
  ];

  return (
    <Table
      className="panel-card"
      rowKey={(record) => `${record.productCodeNorm}-${record.productId}`}
      columns={columns}
      dataSource={data}
      scroll={{ x: 1820 }}
      pagination={{ pageSize: paginationSize }}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record)
      })}
    />
  );
}
