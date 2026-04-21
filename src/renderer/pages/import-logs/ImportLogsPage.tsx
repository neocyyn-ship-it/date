import { Table } from 'antd';
import { useEffect, useState } from 'react';
import type { ImportBatch } from '@shared/types';

export function ImportLogsPage() {
  const [logs, setLogs] = useState<ImportBatch[]>([]);
  useEffect(() => {
    window.ecomApi.importer.getImportLogs().then(setLogs);
  }, []);
  return (
    <Table
      className="panel-card"
      rowKey="batchId"
      dataSource={logs}
      columns={[
        { title: '文件名', dataIndex: 'fileName' },
        { title: '导入时间', dataIndex: 'importedAt' },
        { title: '模板类型', dataIndex: 'sourceType' },
        { title: '导入状态', dataIndex: 'importStatus' },
        { title: '新增条数', dataIndex: 'insertedCount' },
        { title: '替换条数', dataIndex: 'replacedCount' },
        { title: '错误摘要', dataIndex: 'message' }
      ]}
    />
  );
}
