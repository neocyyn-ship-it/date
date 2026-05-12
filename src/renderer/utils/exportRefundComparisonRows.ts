import type { RefundPeriodComparisonRow } from '@shared/types';

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) {
    return '--';
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function exportRefundComparisonRowsToCsv(rows: RefundPeriodComparisonRow[], fileName: string) {
  const headers = ['货号', '商品名', '本周期支付金额', '上周期支付金额', '支付环比', '本周期总退款率', '上周期总退款率', '退款率变化值'];

  const lines = rows.map((item) =>
    [
      item.productCodeNorm,
      item.productName,
      item.currentPayAmount.toFixed(2),
      item.previousPayAmount.toFixed(2),
      formatPercent(item.payMom),
      formatPercent(item.currentRefundRate),
      formatPercent(item.previousRefundRate),
      formatPercent(item.refundRateDiff)
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
