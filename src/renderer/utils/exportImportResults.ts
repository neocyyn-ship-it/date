import type { ImportCommitResult } from '@shared/types';

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportImportResultsToCsv(rows: ImportCommitResult[], fileName: string) {
  const headers = ['批次ID', '文件名', '模板类型', '导入状态', '新增条数', '替换条数', '新增周期', '替换周期', '错误日志'];

  const lines = rows.map((item) =>
    [
      item.batch.batchId,
      item.batch.fileName,
      item.batch.sourceType,
      item.batch.importStatus,
      item.insertedCount,
      item.replacedCount,
      item.addedPeriods.join(' / '),
      item.replacedPeriods.join(' / '),
      item.errors.join(' / ')
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
