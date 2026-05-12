import type { ImportBatch } from '@shared/types';

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getSourceTypeLabel(sourceType: ImportBatch['sourceType']) {
  if (sourceType === 'product_template') return '商品经营模板';
  if (sourceType === 'refund_template') return '退款分析模板';
  if (sourceType === 'image_mapping_template') return '图片映射模板';
  return '未识别模板';
}

export function exportImportLogsToCsv(rows: ImportBatch[], fileName: string) {
  const headers = ['批次ID', '文件名', '文件Hash', '模板类型', '导入时间', '导入状态', '新增条数', '替换条数', '日志摘要'];

  const lines = rows.map((item) =>
    [
      item.batchId,
      item.fileName,
      item.fileHash,
      getSourceTypeLabel(item.sourceType),
      item.importedAt,
      item.importStatus,
      item.insertedCount ?? 0,
      item.replacedCount ?? 0,
      item.message || ''
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
