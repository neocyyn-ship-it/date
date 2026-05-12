export type SourceType =
  | 'refund_template'
  | 'product_template'
  | 'image_mapping_template'
  | 'unknown_template';

export type PeriodType =
  | 'weekly_exact'
  | 'range_exact'
  | 'rolling_30d'
  | 'monthly'
  | 'unknown';

export interface PeriodInfo {
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  periodType: PeriodType;
  hasProductData?: boolean;
  hasRefundData?: boolean;
}

export interface ImportBatch {
  batchId: string;
  fileName: string;
  fileHash: string;
  sourceType: SourceType;
  importedAt: string;
  importStatus: 'pending' | 'success' | 'failed';
  message: string;
  insertedCount?: number;
  replacedCount?: number;
}

export interface RefundFact {
  id: string;
  batchId: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  periodType: PeriodType;
  productCodeRaw: string;
  productCodeNorm: string;
  productName: string;
  spend: number;
  payAmount: number;
  salesQty: number;
  refundPreAmount: number;
  refundPreRate: number;
  refundPostAmount: number;
  refundPostRate: number;
  refundAftersaleAmount: number;
  refundAftersaleRate: number;
  refundTotalAmount: number;
  refundTotalRate: number;
  sourceSheet: string;
}

export interface ProductFact {
  id: string;
  batchId: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  periodType: PeriodType;
  productId: string;
  productCodeRaw: string;
  productCodeNorm: string;
  productName: string;
  visitors: number;
  favUsers: number;
  cartQty: number;
  payBuyers: number;
  payQty: number;
  payAmount: number;
  successRefundAmount: number;
  impressions: number;
  clicks: number;
  adCost: number;
  directGmv: number;
  indirectGmv: number;
  totalGmv: number;
  roi: number;
  sourceSheet: string;
  imageUrl?: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  productCodeNorm: string;
  imagePath: string;
  imageSource: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface ImportPreviewResult {
  fileName: string;
  sourceType: SourceType;
  status: 'ready' | 'needs_mapping' | 'failed';
  message: string;
  periodLabels: string[];
  headers: string[];
  missingRequiredFields: string[];
  previewRows: Record<string, unknown>[];
  detectedMappings: Record<string, string>;
  meta: {
    sheetCount: number;
    rowCount: number;
    replaceEstimate: number;
    insertEstimate: number;
  };
}

export interface ImportCommitResult {
  batch: ImportBatch;
  insertedCount: number;
  replacedCount: number;
  addedPeriods: string[];
  replacedPeriods: string[];
  errors: string[];
}

export interface FilterState {
  periodLabel?: string;
  periodType?: PeriodType | 'all';
  sourceSheet?: string;
  focusTag?: string;
  minPayAmount?: number;
  minAdCost?: number;
  minRefundRate?: number;
  roiBucket?: 'all' | 'lt1' | '1to2' | 'gte2';
  adShareBucket?: 'all' | 'lt30' | '30to60' | 'gte60';
  imageMode?: 'all' | 'withImage' | 'withoutImage';
  keyword?: string;
}

export interface OverviewMetrics {
  totalPayAmount: number;
  totalAdCost: number;
  roi: number;
  totalRefundRate: number;
  refundPreRate: number;
  refundPostRate: number;
  refundAftersaleRate: number;
}

export interface TrendPoint {
  periodLabel: string;
  payAmount: number;
  adCost: number;
  totalGmv: number;
  refundTotalAmount?: number;
  roi?: number;
}

export interface RankingItem {
  productId: string;
  productCodeNorm: string;
  productName: string;
  imagePath?: string;
  payAmount: number;
  adCost: number;
  directGmv: number;
  indirectGmv: number;
  totalGmv: number;
  roi: number;
  payQty: number;
  adAttributedShare: number;
}

export interface QuadrantPoint {
  productId: string;
  productCodeNorm: string;
  productName: string;
  spend: number;
  payAmount: number;
  bubbleSize: number;
  roi: number;
  imagePath?: string;
}

export interface ProductTableItem extends RankingItem {
  successRefundAmount: number;
  refundPreRate: number;
  refundPostRate: number;
  refundAftersaleRate: number;
  momChange: number | null;
  tags: string[];
}

export interface ProductDetail {
  product: ProductTableItem | null;
  trend: TrendPoint[];
  refundStructure: {
    pre: number;
    post: number;
    aftersale: number;
  };
}

export interface RefundDiagnostics {
  avgPreRate: number;
  avgPostRate: number;
  avgAftersaleRate: number;
  preHighList: ProductTableItem[];
  postHighList: ProductTableItem[];
  aftersaleHighList: ProductTableItem[];
  tripleHighList: ProductTableItem[];
  structureTrend: TrendPoint[];
}

export interface RefundPeriodComparisonRow {
  productCodeNorm: string;
  productName: string;
  imagePath?: string;
  currentPayAmount: number;
  previousPayAmount: number;
  payMom: number | null;
  currentRefundRate: number;
  previousRefundRate: number;
  refundRateDiff: number | null;
}

export interface MarketingEfficiency {
  kpis: {
    adCost: number;
    adRevenue: number;
    roi: number;
    cpc: number;
    ctr: number;
  };
  trend: TrendPoint[];
  comparison: TrendPoint[];
  quadrant: QuadrantPoint[];
  naturalStrong: ProductTableItem[];
  adsDriven: ProductTableItem[];
  highSpendLowOutput: ProductTableItem[];
}

export interface DashboardPayload {
  metrics: OverviewMetrics;
  trend: TrendPoint[];
  ranking: RankingItem[];
  quadrant: QuadrantPoint[];
}

export interface IEcomApi {
  importer: {
    selectFiles: () => Promise<string[]>;
    selectImageDirectory: () => Promise<string | null>;
    previewFiles: (filePaths: string[], overrides?: Record<string, string>) => Promise<ImportPreviewResult[]>;
    commitFiles: (filePaths: string[], overrides?: Record<string, string>, imageDirectory?: string) => Promise<ImportCommitResult[]>;
    getImportLogs: () => Promise<ImportBatch[]>;
    scanImageDirectory: (dirPath: string) => Promise<{ matchedCount: number; samples: Array<{ code: string; path: string }> }>;
    loadSavedMappings: (sourceType: SourceType) => Promise<Record<string, string>>;
    saveMappings: (sourceType: SourceType, mappings: Record<string, string>) => Promise<void>;
  };
  analytics: {
    getFilters: () => Promise<{ periods: PeriodInfo[]; sourceSheets: string[] }>;
    getDashboard: (filters: FilterState) => Promise<DashboardPayload>;
    getMarketing: (filters: FilterState) => Promise<MarketingEfficiency>;
    getRefundDiagnostics: (filters: FilterState) => Promise<RefundDiagnostics>;
    getRefundPeriodComparison: (filters: FilterState) => Promise<RefundPeriodComparisonRow[]>;
    getProducts: (filters: FilterState) => Promise<ProductTableItem[]>;
    getProductDetail: (productCodeNorm: string) => Promise<ProductDetail>;
  };
  system: {
    openExternal: (target: string) => Promise<void>;
    getSampleFiles: () => Promise<string[]>;
  };
}
