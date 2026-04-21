import { Button, Card, Select, Space, Tag, Typography } from 'antd';

interface Props {
  headers: string[];
  missingFields: string[];
  value: Record<string, string>;
  detectedMappings?: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onSave?: () => void;
}

export function FieldMappingEditor({ headers, missingFields, value, detectedMappings, onChange, onSave }: Props) {
  if (!missingFields.length) return null;

  const setField = (field: string, selected?: string) => {
    const next = { ...value };
    if (selected) next[field] = selected;
    else delete next[field];
    onChange(next);
  };

  const applyDetected = () => {
    if (!detectedMappings) return;
    onChange({ ...value, ...detectedMappings });
  };

  const clearMissing = () => {
    const next = { ...value };
    for (const field of missingFields) {
      delete next[field];
    }
    onChange(next);
  };

  return (
    <Card
      className="panel-card"
      title="字段映射修正"
      extra={
        <Space>
          <Button size="small" onClick={applyDetected}>使用系统建议</Button>
          <Button size="small" onClick={clearMissing}>清空当前选择</Button>
          {onSave ? <Button size="small" type="primary" onClick={onSave}>保存为模板配置</Button> : null}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text type="secondary">
          当模板列名识别不完整时，可以在这里手工指定原始列名。当前选择会直接参与预览和正式导入。
        </Typography.Text>
        {missingFields.map((field) => (
          <Space key={field} style={{ width: '100%', justifyContent: 'space-between' }} align="start">
            <Space direction="vertical" size={4}>
              <Typography.Text style={{ minWidth: 160 }}>{field}</Typography.Text>
              {detectedMappings?.[field] ? <Tag color="blue">建议：{detectedMappings[field]}</Tag> : <Tag>未识别</Tag>}
            </Space>
            <Select
              allowClear
              style={{ width: 320 }}
              value={value[field]}
              placeholder={`为 ${field} 选择原始列`}
              options={headers.map((header) => ({ label: header, value: header }))}
              onChange={(selected) => setField(field, selected)}
            />
          </Space>
        ))}
      </Space>
    </Card>
  );
}
