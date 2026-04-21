import { businessConfig } from '@backend/config/businessConfig';

export function normalizeProductCode(input: unknown, trimSuffix = false): string {
  const raw = String(input ?? '')
    .replace(/[（(【\[].*?[】\])）]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (!raw) return '';

  let normalized = raw.replace(/[^\w\-\/]/g, '');
  if (trimSuffix) {
    for (const suffix of businessConfig.categorySuffixes) {
      normalized = normalized.replace(new RegExp(`${suffix}$`, 'i'), '');
    }
  }
  return normalized.trim();
}

export function extractRefundProductCode(record: Record<string, unknown>) {
  const raw = String(record['商家编码'] || record['货号'] || record['sku图'] || '').trim();
  return {
    productCodeRaw: raw,
    productCodeNorm: normalizeProductCode(raw)
  };
}
