import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, List, Space, Table, Typography, Upload, message } from 'antd';
import { useState } from 'react';
import type { ImportCommitResult, ImportPreviewResult } from '@shared/types';

export function ImportCenterPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResult[]>([]);
  const [result, setResult] = useState<ImportCommitResult[]>([]);
  const [loading, setLoading] = useState(false);

  const selectFiles = async () => {
    const selected = await window.ecomApi.importer.selectFiles();
    setFiles(selected);
  };

  const loadSamples = async () => {
    const sampleFiles = await window.ecomApi.system.getSampleFiles();
    setFiles(sampleFiles);
    message.success('已加载工程内置样例 Excel。');
  };

  const previewImport = async () => {
    setLoading(true);
    const payload = await window.ecomApi.importer.previewFiles(files);
    setPreview(payload);
    setLoading(false);
  };

  const commitImport = async () => {
    setLoading(true);
    const payload = await window.ecomApi.importer.commitFiles(files);
    setResult(payload);
    setLoading(false);
    message.success('导入完成，页面数据已可刷新查看。');
  };

  return (
    <div className="page-stack">
      <Card className="panel-card">
        <Space>
          <Button type="primary" onClick={selectFiles}>选择 Excel 文件</Button>
          <Button onClick={loadSamples}>加载样例数据</Button>
          <Button onClick={previewImport} disabled={!files.length} loading={loading}>预览清洗结果</Button>
          <Button type="primary" onClick={commitImport} disabled={!files.length} loading={loading}>确认导入</Button>
        </Space>
        <Upload.Dragger openFileDialogOnClick={false} showUploadList={false} style={{ marginTop: 16 }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">支持持续上传 Excel 文件，当前建议直接点击“选择 Excel 文件”</p>
          <p className="ant-upload-hint">已选文件将进入预览、周期识别、替换/新增估算与正式导入流程</p>
        </Upload.Dragger>
        <List
          style={{ marginTop: 16 }}
          bordered
          dataSource={files}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>

      {!!preview.length && (
        <Card className="panel-card" title="导入预览">
          {preview.map((item) => (
            <div key={item.fileName} style={{ marginBottom: 20 }}>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="文件名">{item.fileName}</Descriptions.Item>
                <Descriptions.Item label="模板类型">{item.sourceType}</Descriptions.Item>
                <Descriptions.Item label="导入状态">{item.status}</Descriptions.Item>
                <Descriptions.Item label="周期识别">{item.periodLabels.join('、')}</Descriptions.Item>
                <Descriptions.Item label="预估新增">{item.meta.insertEstimate}</Descriptions.Item>
                <Descriptions.Item label="预估替换">{item.meta.replaceEstimate}</Descriptions.Item>
              </Descriptions>
              {item.missingRequiredFields.length > 0 && (
                <Alert
                  style={{ marginTop: 12 }}
                  type="warning"
                  showIcon
                  message={`存在未完整识别字段：${item.missingRequiredFields.join('、')}`}
                />
              )}
              <Table
                style={{ marginTop: 12 }}
                size="small"
                pagination={false}
                dataSource={item.previewRows.map((row, index) => ({ key: index, ...row }))}
                columns={item.headers.slice(0, 10).map((header) => ({ title: header, dataIndex: header, key: header }))}
                scroll={{ x: 1200 }}
              />
            </div>
          ))}
        </Card>
      )}

      {!!result.length && (
        <Card className="panel-card" title="导入结果">
          {result.map((item) => (
            <Alert
              key={item.batch.batchId}
              style={{ marginBottom: 12 }}
              type={item.errors.length ? 'error' : 'success'}
              message={`${item.batch.fileName}：新增 ${item.insertedCount} 条，替换 ${item.replacedCount} 条`}
              description={
                <div>
                  <Typography.Paragraph>新增周期：{item.addedPeriods.join('、') || '无'}</Typography.Paragraph>
                  <Typography.Paragraph>替换周期：{item.replacedPeriods.join('、') || '无'}</Typography.Paragraph>
                  <Typography.Paragraph>错误日志：{item.errors.join('；') || '无'}</Typography.Paragraph>
                </div>
              }
            />
          ))}
        </Card>
      )}
    </div>
  );
}
