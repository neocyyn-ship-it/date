import type { ProductTableItem } from '@shared/types';
import type { ProductColumnKey } from './productColumns';

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatPercent(value: number) {
  return `${((value || 0) * 100).toFixed(2)}%`;
}

const columnHeaderMap: Record<ProductColumnKey, string> = {
  product: '商品',
  payAmount: '生参支付金额',
  adCost: '阿里妈妈花费',
  roi: '阿里妈妈投产比',
  adAttributedShare: '广告成交占比',
  totalGmv: '广告成交金额',
  successRefundAmount: '成功退款金额',
  refundPreRate: '发货前退款率',
  refundPostRate: '发货后退款率',
  refundAftersaleRate: '售后退款率',
  momChange: '支付环比',
  tags: '标签'
};

function getColumnValue(item: ProductTableItem, column: ProductColumnKey) {
  switch (column) {
    case 'product':
      return `${item.productCodeNorm} ${item.productName}`;
    case 'payAmount':
      return item.payAmount.toFixed(2);
    case 'adCost':
      return item.adCost.toFixed(2);
    case 'roi':
      return item.roi.toFixed(2);
    case 'adAttributedShare':
      return formatPercent(item.adAttributedShare);
    case 'totalGmv':
      return item.totalGmv.toFixed(2);
    case 'successRefundAmount':
      return item.successRefundAmount.toFixed(2);
    case 'refundPreRate':
      return formatPercent(item.refundPreRate);
    case 'refundPostRate':
      return formatPercent(item.refundPostRate);
    case 'refundAftersaleRate':
      return formatPercent(item.refundAftersaleRate);
    case 'momChange':
      return item.momChange === null ? '--' : formatPercent(item.momChange);
    case 'tags':
      return item.tags.join(' / ');
    default:
      return '';
  }
}

export function exportProductRowsToCsv(rows: ProductTableItem[], fileName: string, visibleColumns: ProductColumnKey[]) {
  const headers = visibleColumns.map((column) => columnHeaderMap[column]);
  const lines = rows.map((item) => visibleColumns.map((column) => escapeCsv(getColumnValue(item, column))).join(','));
  const csvContent = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
