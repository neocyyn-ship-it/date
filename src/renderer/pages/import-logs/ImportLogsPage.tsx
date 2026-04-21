import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Drawer, Empty, Input, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { ImportBatch } from '@shared/types';

type StatusFilter = ImportBatch['importStatus'] | 'all';
type SourceFilter = ImportBatch['sourceType'] | 'all';

function getSourceTypeLabel(sourceType: ImportBatch['sourceType']) {
  if (sourceType === 'product_template') return '商品经营模板';
  if (sourceType === 'refund_template') return '退款分析模板';
  if (sourceType === 'image_mapping_template') return '图片映射模板';
  return '未识别模板';
}

function renderStatus(status: ImportBatch['importStatus']) {
  if (status === 'success') {
    return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
  }
  if (status === 'failed') {
    return <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>;
  }
  return <Tag color="processing" icon={<ClockCircleOutlined />}>处理中</Tag>;
}

export function ImportLogsPage() {
  const [logs, setLogs] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const payload = await window.ecomApi.importer.getImportLogs();
      setLogs(payload);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (statusFilter !== 'all' && item.importStatus !== statusFilter) return false;
      if (sourceFilter !== 'all' && item.sourceType !== sourceFilter) return false;
      if (!keyword.trim()) return true;
      const text = `${item.fileName} ${item.message} ${item.fileHash}`.toLowerCase();
      return text.includes(keyword.trim().toLowerCase());
    });
  }, [keyword, logs, sourceFilter, statusFilter]);

  const summary = useMemo(() => {
    return filteredLogs.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.inserted += Number(item.insertedCount || 0);
        acc.replaced += Number(item.replacedCount || 0);
        if (item.importStatus === 'success') acc.success += 1;
        if (item.importStatus === 'failed') acc.failed += 1;
        return acc;
      },
      { total: 0, success: 0, failed: 0, inserted: 0, replaced: 0 }
    );
  }, [filteredLogs]);

  const columns: ColumnsType<ImportBatch & { netChange: number }> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      width: 240,
      ellipsis: true
    },
    {
      title: '导入时间',
      dataIndex: 'importedAt',
      width: 180,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '模板类型',
      dataIndex: 'sourceType',
      width: 140,
      render: (value: ImportBatch['sourceType']) => getSourceTypeLabel(value)
    },
    {
      title: '导入状态',
      dataIndex: 'importStatus',
      width: 120,
      render: (value: ImportBatch['importStatus']) => renderStatus(value)
    },
    {
      title: '新增条数',
      dataIndex: 'insertedCount',
      width: 110,
      align: 'right'
    },
    {
      title: '替换条数',
      dataIndex: 'replacedCount',
      width: 110,
      align: 'right'
    },
    {
      title: '净变化',
      dataIndex: 'netChange',
      width: 100,
      align: 'right',
      render: (value: number) => <Typography.Text strong>{value}</Typography.Text>
    },
    {
      title: '日志摘要',
      dataIndex: 'message',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_value, record) => <Button type="link" onClick={() => setSelectedBatch(record)}>查看详情</Button>
    }
  ];

  return (
    <div className="page-stack">
      <Space size={16} style={{ width: '100%' }} wrap>
        <Card className="panel-card" style={{ minWidth: 220 }}>
          <Statistic title="导入批次数" value={summary.total} />
        </Card>
        <Card className="panel-card" style={{ minWidth: 220 }}>
          <Statistic title="成功批次" value={summary.success} valueStyle={{ color: '#3f8600' }} />
        </Card>
        <Card className="panel-card" style={{ minWidth: 220 }}>
          <Statistic title="失败批次" value={summary.failed} valueStyle={{ color: '#cf1322' }} />
        </Card>
        <Card className="panel-card" style={{ minWidth: 220 }}>
          <Statistic title="累计新增 / 替换" value={`${summary.inserted} / ${summary.replaced}`} />
        </Card>
      </Space>

      <Card
        className="panel-card"
        title="导入记录"
        extra={<Button icon={<ReloadOutlined />} onClick={() => void loadLogs()} loading={loading}>刷新记录</Button>}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
              { label: '处理中', value: 'pending' }
            ]}
          />
          <Select<SourceFilter>
            value={sourceFilter}
            onChange={setSourceFilter}
            style={{ width: 180 }}
            options={[
              { label: '全部模板', value: 'all' },
              { label: '商品经营模板', value: 'product_template' },
              { label: '退款分析模板', value: 'refund_template' },
              { label: '图片映射模板', value: 'image_mapping_template' },
              { label: '未识别模板', value: 'unknown_template' }
            ]}
          />
          <Input.Search
            allowClear
            placeholder="搜索文件名、日志摘要、文件 Hash"
            style={{ width: 320 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Space>

        <Table
          rowKey="batchId"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无导入记录" /> }}
          dataSource={filteredLogs.map((item) => ({
            ...item,
            netChange: Number(item.insertedCount || 0) - Number(item.replacedCount || 0)
          }))}
          columns={columns}
          scroll={{ x: 1280 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Drawer
        width={720}
        title="批次详情"
        open={!!selectedBatch}
        onClose={() => setSelectedBatch(null)}
      >
        {selectedBatch ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="批次 ID">{selectedBatch.batchId}</Descriptions.Item>
            <Descriptions.Item label="文件 Hash">{selectedBatch.fileHash}</Descriptions.Item>
            <Descriptions.Item label="文件名" span={2}>{selectedBatch.fileName}</Descriptions.Item>
            <Descriptions.Item label="模板类型">{getSourceTypeLabel(selectedBatch.sourceType)}</Descriptions.Item>
            <Descriptions.Item label="导入状态">{renderStatus(selectedBatch.importStatus)}</Descriptions.Item>
            <Descriptions.Item label="新增条数">{selectedBatch.insertedCount ?? 0}</Descriptions.Item>
            <Descriptions.Item label="替换条数">{selectedBatch.replacedCount ?? 0}</Descriptions.Item>
            <Descriptions.Item label="净变化">{Number(selectedBatch.insertedCount || 0) - Number(selectedBatch.replacedCount || 0)}</Descriptions.Item>
            <Descriptions.Item label="导入时间">{dayjs(selectedBatch.importedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="错误摘要" span={2}>{selectedBatch.message || '无'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  );
}
