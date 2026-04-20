import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import xlsxModule, { type WorkSheet } from 'xlsx';
import { SOURCE_TYPES } from '@shared/constants/business';
import type { ImportPreviewResult, PeriodInfo, ProductFact, RefundFact, SourceType } from '@shared/types';
import { PeriodParserService } from '@backend/mappers/PeriodParserService';
import { extractRefundProductCode, normalizeProductCode } from '@backend/mappers/ProductCodeService';

const XLSX = (xlsxModule as unknown as { default?: typeof xlsxModule }).default ?? xlsxModule;
type Mapping = Record<string, string>;

const refundFieldAliases: Record<string, string[]> = {
  商家编码: ['商家编码', '货号'],
  sku图: ['sku图', 'SKU图', 'sku图链接'],
  花费: ['花费', '消耗'],
  支付金额: ['支付金额', '成交金额', '支付gmv'],
  销售数量: ['销售数量', '支付件数'],
  发货前退款金额: ['发货前退款金额', '发货前商品退款'],
  发货前退款金额占比: ['发货前退款金额占比', '发货前退款率', '发货前商品退款占比'],
  发货后退款金额: ['发货后退款金额', '发货后商品退款'],
  发货后退款金额占比: ['发货后退款金额占比', '发货后退款率', '发货后商品退款占比'],
  售后退款金额: ['售后退款金额', '售后商品退款'],
  售后退款金额占比: ['售后退款金额占比', '售后退款率', '售后商品退款占比'],
  总退款金额: ['总退款金额', '总退货金额'],
  总退款金额占比: ['总退款金额占比', '总退款率'],
  商品名称: ['商品名称', '宝贝名称', '名称']
};

const productFieldAliases: Record<string, string[]> = {
  商品ID: ['商品ID', '宝贝id', '商品id'],
  货号: ['货号', '商家编码'],
  商品名称: ['商品名称', '宝贝名称'],
  访客数: ['访客数', '访客人数', '商品访客数'],
  收藏数: ['收藏数', '商品收藏人数'],
  加购数: ['加购数', '商品加购件数'],
  支付买家数: ['支付买家数'],
  支付件数: ['支付件数'],
  支付金额: ['支付金额', '成交金额'],
  成功退款金额: ['成功退款金额', '退款金额'],
  展现量: ['展现量', '曝光量'],
  点击量: ['点击量'],
  花费: ['花费', '消耗'],
  直接成交金额: ['直接成交金额'],
  间接成交金额: ['间接成交金额'],
  总成交金额: ['总成交金额', '广告成交金额'],
  投入产出比: ['投入产出比', 'ROI'],
  主图: ['主图', 'PIC', '图片链接', '主图链接']
};

function parseNumber(input: unknown) {
  const raw = String(input ?? '').replace(/[￥%,，,\s]/g, '');
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function parseRate(input: unknown, fallbackNumerator = 0, fallbackDenominator = 0) {
  const raw = String(input ?? '').trim();
  if (!raw) {
    return fallbackDenominator > 0 ? fallbackNumerator / fallbackDenominator : 0;
  }
  if (raw.includes('%')) return parseNumber(raw) / 100;
  const numeric = parseNumber(raw);
  if (numeric > 0 && numeric <= 1) return numeric;
  if (numeric > 1 && numeric <= 100) return numeric / 100;
  return fallbackDenominator > 0 ? fallbackNumerator / fallbackDenominator : 0;
}

function detectSourceType(sheetNames: string[], headers: string[]): SourceType {
  if (
    headers.some((header) =>
      ['发货前退款金额', '发货前商品退款', '发货后退款金额', '发货后商品退款', '售后退款金额', '售后商品退款', '总退货金额'].includes(header)
    )
  ) {
    return SOURCE_TYPES.refund;
  }
  if (headers.some((header) => ['商品ID', '商品访客数', '总成交金额', '支付件数'].includes(header))) {
    return SOURCE_TYPES.product;
  }
  if (sheetNames.some((name) => /主图|图片|PIC/i.test(name))) {
    return SOURCE_TYPES.imageMapping;
  }
  return SOURCE_TYPES.unknown;
}

function resolveHeaderMap(headers: string[], aliasMap: Record<string, string[]>, overrides?: Mapping) {
  const headerMap: Mapping = {};
  const missing: string[] = [];
  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    if (overrides?.[canonical]) {
      headerMap[canonical] = overrides[canonical];
      continue;
    }
    const matched = headers.find((header) => aliases.includes(String(header).trim()));
    if (matched) headerMap[canonical] = matched;
    else missing.push(canonical);
  }
  return { headerMap, missing };
}

function detectHeaderRowIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const values = row.map((cell) => String(cell ?? '').trim());
    return values.includes('商品ID') || values.includes('支付金额') || values.includes('商家编码') || values.includes('总退货金额');
  });
}

function normalizeSheetRows(sheet: WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false
  });
  const headerRowIndex = detectHeaderRowIndex(matrix);
  if (headerRowIndex < 0) {
    return { headers: [] as string[], rows: [] as Record<string, unknown>[] };
  }
  const headers = (matrix[headerRowIndex] || []).map((cell) => String(cell ?? '').trim());
  const rows = matrix
    .slice(headerRowIndex + 1)
    .map((row) =>
      headers.reduce<Record<string, unknown>>((acc, header, index) => {
        if (header) acc[header] = row[index];
        return acc;
      }, {})
    )
    .filter((row) => Object.values(row).some((value) => value !== null && String(value).trim() !== ''));
  return { headers, rows };
}

export class ExcelImporterService {
  static fileHash(filePath: string) {
    const buffer = readFileSync(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }

  static async preview(filePath: string, overrides?: Mapping): Promise<ImportPreviewResult> {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const firstSheetRows = normalizeSheetRows(workbook.Sheets[workbook.SheetNames[0]]);
    const headers = firstSheetRows.headers;
    const sourceType = detectSourceType(workbook.SheetNames, headers);
    const aliasSource = sourceType === SOURCE_TYPES.refund ? refundFieldAliases : productFieldAliases;
    const { headerMap, missing } = resolveHeaderMap(headers, aliasSource, overrides);
    const allRows = workbook.SheetNames.flatMap((sheetName) =>
      normalizeSheetRows(workbook.Sheets[sheetName]).rows.map((row) => ({ ...row, __sheetName: sheetName }))
    );
    const periodLabels = [...new Set(workbook.SheetNames.map((name) => PeriodParserService.parse(name).periodLabel))];

    return {
      fileName: filePath.split(/[\\/]/).pop() || filePath,
      sourceType,
      status: missing.length > 4 ? 'needs_mapping' : 'ready',
      message: missing.length > 4 ? '存在较多未识别字段，请确认映射关系。' : '模板识别成功，可直接导入。',
      periodLabels,
      headers,
      missingRequiredFields: missing,
      previewRows: allRows.slice(0, 8),
      detectedMappings: headerMap,
      meta: {
        sheetCount: workbook.SheetNames.length,
        rowCount: allRows.length,
        replaceEstimate: Math.floor(allRows.length * 0.4),
        insertEstimate: Math.ceil(allRows.length * 0.6)
      }
    };
  }

  static parseRefundRecords(filePath: string, overrides?: Mapping) {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const headerRows = normalizeSheetRows(workbook.Sheets[workbook.SheetNames[0]]);
    const { headerMap } = resolveHeaderMap(headerRows.headers, refundFieldAliases, overrides);
    const records: RefundFact[] = [];

    for (const sheetName of workbook.SheetNames) {
      const period = PeriodParserService.parse(sheetName);
      const rows = normalizeSheetRows(workbook.Sheets[sheetName]).rows;
      for (const row of rows) {
        const { productCodeRaw, productCodeNorm } = extractRefundProductCode(row);
        if (!productCodeNorm) continue;
        const payAmount = parseNumber(row[headerMap['支付金额']]);
        const refundPreAmount = parseNumber(row[headerMap['发货前退款金额']]);
        const refundPostAmount = parseNumber(row[headerMap['发货后退款金额']]);
        const refundAftersaleAmount = parseNumber(row[headerMap['售后退款金额']]);
        const refundTotalAmount = parseNumber(row[headerMap['总退款金额']]) || refundPreAmount + refundPostAmount + refundAftersaleAmount;
        records.push({
          id: randomUUID(),
          batchId: '',
          periodLabel: period.periodLabel,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          periodType: period.periodType,
          productCodeRaw,
          productCodeNorm,
          productName: String(row[headerMap['商品名称']] || productCodeRaw || ''),
          spend: parseNumber(row[headerMap['花费']]),
          payAmount,
          salesQty: parseNumber(row[headerMap['销售数量']]),
          refundPreAmount,
          refundPreRate: parseRate(row[headerMap['发货前退款金额占比']], refundPreAmount, payAmount),
          refundPostAmount,
          refundPostRate: parseRate(row[headerMap['发货后退款金额占比']], refundPostAmount, payAmount),
          refundAftersaleAmount,
          refundAftersaleRate: parseRate(row[headerMap['售后退款金额占比']], refundAftersaleAmount, payAmount),
          refundTotalAmount,
          refundTotalRate: parseRate(row[headerMap['总退款金额占比']], refundTotalAmount, payAmount),
          sourceSheet: sheetName
        });
      }
    }

    return records;
  }

  static parseProductRecords(filePath: string, overrides?: Mapping) {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const productSheets = workbook.SheetNames.filter((name) => !/主图id表/i.test(name));
    const imageSheets = workbook.SheetNames.filter((name) => /主图id表/i.test(name));
    const imageMap: Record<string, string> = {};

    for (const sheetName of imageSheets) {
      const rows = normalizeSheetRows(workbook.Sheets[sheetName]).rows;
      for (const row of rows) {
        const productId = String(row['商品ID'] || row['主图ID'] || '').trim();
        const productCode = normalizeProductCode(row['货号'] || row['商家编码']);
        const imagePath = String(row['主图'] || row['PIC'] || row['图片链接'] || '').trim();
        if (productId && imagePath) imageMap[productId] = imagePath;
        if (productCode && imagePath) imageMap[productCode] = imagePath;
      }
    }

    const headerRows = normalizeSheetRows(workbook.Sheets[productSheets[0]]);
    const { headerMap } = resolveHeaderMap(headerRows.headers, productFieldAliases, overrides);
    const records: ProductFact[] = [];

    for (const sheetName of productSheets) {
      const period: PeriodInfo = PeriodParserService.parse(sheetName);
      const rows = normalizeSheetRows(workbook.Sheets[sheetName]).rows;
      for (const row of rows) {
        const productId = String(row[headerMap['商品ID']] || '').trim();
        const productCodeRaw = String(row[headerMap['货号']] || '').trim();
        const productCodeNorm = normalizeProductCode(productCodeRaw);
        if (!productId && !productCodeNorm) continue;
        const adCost = parseNumber(row[headerMap['花费']]);
        const totalGmv = parseNumber(row[headerMap['总成交金额']]);
        const roiRaw = parseNumber(row[headerMap['投入产出比']]);
        records.push({
          id: randomUUID(),
          batchId: '',
          periodLabel: period.periodLabel,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          periodType: period.periodType,
          productId,
          productCodeRaw,
          productCodeNorm,
          productName: String(row[headerMap['商品名称']] || productCodeRaw || productId),
          visitors: parseNumber(row[headerMap['访客数']]),
          favUsers: parseNumber(row[headerMap['收藏数']]),
          cartQty: parseNumber(row[headerMap['加购数']]),
          payBuyers: parseNumber(row[headerMap['支付买家数']]),
          payQty: parseNumber(row[headerMap['支付件数']]),
          payAmount: parseNumber(row[headerMap['支付金额']]),
          successRefundAmount: parseNumber(row[headerMap['成功退款金额']]),
          impressions: parseNumber(row[headerMap['展现量']]),
          clicks: parseNumber(row[headerMap['点击量']]),
          adCost,
          directGmv: parseNumber(row[headerMap['直接成交金额']]),
          indirectGmv: parseNumber(row[headerMap['间接成交金额']]),
          totalGmv,
          roi: roiRaw || (adCost > 0 ? totalGmv / adCost : 0),
          sourceSheet: sheetName,
          imageUrl: String(row[headerMap['主图']] || imageMap[productId] || imageMap[productCodeNorm] || '')
        });
      }
    }

    return records;
  }
}
