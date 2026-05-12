import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, List, Space, Statistic, Table, Typography, Upload, message } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilterStore } from '@renderer/stores/filterStore';
import { exportImportResultsToCsv } from '@renderer/utils/exportImportResults';
import type { ImportCommitResult, ImportPreviewResult } from '@shared/types';
import { FieldMappingEditor } from './FieldMappingEditor';

export function ImportCenterPage() {
  const navigate = useNavigate();
  const { setFilters } = useFilterStore();
  const [files, setFiles] = useState<string[]>([]);
  const [imageDir, setImageDir] = useState('');
  const [imageScan, setImageScan] = useState<{ matchedCount: number; samples: Array<{ code: string; path: string }> } | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult[]>([]);
  const [result, setResult] = useState<ImportCommitResult[]>([]);
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const activeSourceType = preview[0]?.sourceType;

  const resultSummary = useMemo(() => {
    return result.reduce(
      (acc, item) => {
        acc.batchCount += 1;
        acc.inserted += item.insertedCount;
        acc.replaced += item.replacedCount;
        acc.failed += item.errors.length ? 1 : 0;
        acc.periods += item.addedPeriods.length + item.replacedPeriods.length;
        return acc;
      },
      { batchCount: 0, inserted: 0, replaced: 0, failed: 0, periods: 0 }
    );
  }, [result]);

  const selectFiles = async () => {
    const selected = await window.ecomApi.importer.selectFiles();
    setFiles(selected);
    setPreview([]);
    setResult([]);
  };

  const loadSamples = async () => {
    const sampleFiles = await window.ecomApi.system.getSampleFiles();
    setFiles(sampleFiles);
    setPreview([]);
    setResult([]);
    message.success('已加载工程内置样例 Excel。');
  };

  const selectImageDirectory = async () => {
    const dir = await window.ecomApi.importer.selectImageDirectory();
    if (!dir) {
      return;
    }

    setImageDir(dir);
    const scan = await window.ecomApi.importer.scanImageDirectory(dir);
    setImageScan(scan);
    message.success(`图片目录扫描完成，发现 ${scan.matchedCount} 个可匹配文件。`);
  };

  const previewImport = async () => {
    if (!files.length) {
      message.warning('请先选择 Excel 文件。');
      return;
    }

    setLoading(true);
    try {
      const payload = await window.ecomApi.importer.previewFiles(files, mappingOverrides);
      setPreview(payload);
      const detected = payload.reduce<Record<string, string>>((acc, item) => ({ ...acc, ...item.detectedMappings }), {});
      const sourceType = payload[0]?.sourceType;
      const saved = sourceType ? await window.ecomApi.importer.loadSavedMappings(sourceType) : {};
      setMappingOverrides((current) => ({ ...detected, ...saved, ...current }));
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!files.length) {
      message.warning('请先选择 Excel 文件。');
      return;
    }

    setLoading(true);
    try {
      const payload = await window.ecomApi.importer.commitFiles(files, mappingOverrides, imageDir || undefined);
      setResult(payload);

      const filterPayload = await window.ecomApi.analytics.getFilters();
      if (filterPayload.periods.length) {
        const preferredPeriod = filterPayload.periods.find((item) => item.hasProductData) ?? filterPayload.periods[0];
        setFilters({ periodLabel: preferredPeriod.periodLabel });
      }

      message.success('导入完成，已自动切换到最新周期。现在可以去看经营页和导入记录。');
    } finally {
      setLoading(false);
    }
  };

  const saveMappings = async () => {
    if (!activeSourceType || activeSourceType === 'unknown_template') {
      message.warning('当前模板类型未识别，暂不支持保存字段映射。');
      return;
    }

    await window.ecomApi.importer.saveMappings(activeSourceType, mappingOverrides);
    message.success('字段映射已保存为本地模板配置。');
  };

  const exportResult = () => {
    if (!result.length) {
      message.warning('当前没有可导出的导入结果。');
      return;
    }

    exportImportResultsToCsv(result, '导入结果.csv');
    message.success(`已导出 ${result.length} 条导入结果。`);
  };

  return (
    <div className="page-stack">
      <Card className="panel-card">
        <Space wrap>
          <Button type="primary" onClick={selectFiles}>
            选择 Excel 文件
          </Button>
          <Button onClick={loadSamples}>加载样例数据</Button>
          <Button onClick={selectImageDirectory}>选择图片目录</Button>
          <Button onClick={previewImport} disabled={!files.length} loading={loading}>
            预览清洗结果
          </Button>
          <Button type="primary" onClick={commitImport} disabled={!files.length} loading={loading}>
            确认导入
          </Button>
          <Button onClick={() => navigate('/import-logs')}>查看导入记录</Button>
        </Space>

        <Upload.Dragger openFileDialogOnClick={false} showUploadList={false} style={{ marginTop: 16 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">支持持续上传 Excel 文件，当前建议直接点击“选择 Excel 文件”。</p>
          <p className="ant-upload-hint">文件会依次进入预览、周期识别、新增 / 替换估算和正式导入流程。</p>
        </Upload.Dragger>

        <List
          style={{ marginTop: 16 }}
          bordered
          locale={{ emptyText: '还没有选择文件' }}
          dataSource={files}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />

        {imageDir ? (
          <Descriptions style={{ marginTop: 16 }} bordered size="small" column={1}>
            <Descriptions.Item label="图片目录">{imageDir}</Descriptions.Item>
            <Descriptions.Item label="匹配数量">{imageScan?.matchedCount ?? 0}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      {imageScan ? (
        <Card className="panel-card" title="图片扫描预览">
          <Table
            size="small"
            pagination={false}
            rowKey="code"
            dataSource={imageScan.samples}
            columns={[
              { title: '匹配编码', dataIndex: 'code' },
              { title: '图片路径', dataIndex: 'path' }
            ]}
          />
        </Card>
      ) : null}

      {preview.length ? (
        <Card className="panel-card" title="导入预览">
          {preview.map((item) => (
            <div key={item.fileName} style={{ marginBottom: 20 }}>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="文件名">{item.fileName}</Descriptions.Item>
                <Descriptions.Item label="模板类型">{item.sourceType}</Descriptions.Item>
                <Descriptions.Item label="导入状态">{item.status}</Descriptions.Item>
                <Descriptions.Item label="周期识别">{item.periodLabels.join(' / ') || '未识别'}</Descriptions.Item>
                <Descriptions.Item label="预计新增">{item.meta.insertEstimate}</Descriptions.Item>
                <Descriptions.Item label="预计替换">{item.meta.replaceEstimate}</Descriptions.Item>
              </Descriptions>

              {item.missingRequiredFields.length > 0 ? (
                <>
                  <Alert
                    style={{ marginTop: 12 }}
                    type="warning"
                    showIcon
                    message={`存在未完整识别字段：${item.missingRequiredFields.join(' / ')}`}
                    description="请先在下方补充字段映射，再重新执行预览或正式导入。"
                  />
                  <div style={{ marginTop: 12 }}>
                    <FieldMappingEditor
                      headers={item.headers}
                      missingFields={item.missingRequiredFields}
                      value={mappingOverrides}
                      detectedMappings={item.detectedMappings}
                      onChange={setMappingOverrides}
                      onSave={saveMappings}
                    />
                  </div>
                </>
              ) : null}

              <Table
                style={{ marginTop: 12 }}
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="没有可展示的预览数据" /> }}
                dataSource={item.previewRows.map((row, index) => ({ key: index, ...row }))}
                columns={item.headers.slice(0, 10).map((header) => ({
                  title: header,
                  dataIndex: header,
                  key: header
                }))}
                scroll={{ x: 1200 }}
              />
            </div>
          ))}
        </Card>
      ) : null}

      {result.length ? (
        <>
          <Space size={16} style={{ width: '100%' }} wrap>
            <Card className="panel-card" style={{ minWidth: 220 }}>
              <Statistic title="本次导入批次" value={resultSummary.batchCount} />
            </Card>
            <Card className="panel-card" style={{ minWidth: 220 }}>
              <Statistic title="新增记录" value={resultSummary.inserted} valueStyle={{ color: '#3f8600' }} />
            </Card>
            <Card className="panel-card" style={{ minWidth: 220 }}>
              <Statistic title="替换记录" value={resultSummary.replaced} valueStyle={{ color: '#1677ff' }} />
            </Card>
            <Card className="panel-card" style={{ minWidth: 220 }}>
              <Statistic title="失败批次 / 涉及周期" value={`${resultSummary.failed} / ${resultSummary.periods}`} />
            </Card>
          </Space>

          <Card className="panel-card" title="导入结果" extra={<Button onClick={exportResult}>导出导入结果</Button>}>
            {result.map((item) => (
              <Alert
                key={item.batch.batchId}
                style={{ marginBottom: 12 }}
                type={item.errors.length ? 'error' : 'success'}
                message={`${item.batch.fileName}：新增 ${item.insertedCount} 条，替换 ${item.replacedCount} 条`}
                description={
                  <div>
                    <Typography.Paragraph>新增周期：{item.addedPeriods.join(' / ') || '无'}</Typography.Paragraph>
                    <Typography.Paragraph>替换周期：{item.replacedPeriods.join(' / ') || '无'}</Typography.Paragraph>
                    <Typography.Paragraph>错误日志：{item.errors.join('；') || '无'}</Typography.Paragraph>
                  </div>
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
