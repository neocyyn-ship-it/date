import { businessConfig } from '@backend/config/businessConfig';
import { duckDbClient } from '@backend/db/client';
import type {
  DashboardPayload,
  FilterState,
  MarketingEfficiency,
  OverviewMetrics,
  ProductDetail,
  ProductTableItem,
  RefundDiagnostics,
  RefundPeriodComparisonRow,
  TrendPoint
} from '@shared/types';

function sqlLikeKeyword(keyword?: string) {
  return keyword ? `%${keyword}%` : '%';
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function compareMom(currentValue: number, previousValue: number) {
  if (!previousValue) {
    return null;
  }
  return (currentValue - previousValue) / previousValue;
}

function getMedian(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }
  return sorted[middleIndex];
}

function getPeriodParams(filters: FilterState) {
  return {
    periodLabel: filters.periodLabel ?? null,
    periodType: filters.periodType ?? 'all',
    sourceSheet: filters.sourceSheet ?? null,
    keyword: sqlLikeKeyword(filters.keyword)
  };
}

function classifyRow(
  row: ProductTableItem,
  baselines: {
    payAmount: number;
    adCost: number;
    roi: number;
    refundRate: number;
  }
) {
  const tags: string[] = [];
  const adAttributedShare = row.adAttributedShare;
  const refundRate = row.refundPreRate + row.refundPostRate + row.refundAftersaleRate;

  const hasStrongSalesScale = row.payAmount >= baselines.payAmount;
  const hasHighSpend = row.adCost >= baselines.adCost;
  const hasLowSpend = row.adCost <= baselines.adCost * businessConfig.classificationRules.lowSpendRatio;
  const hasLowRoi = row.roi <= baselines.roi * businessConfig.classificationRules.lowRoiRatio;

  if (hasStrongSalesScale && hasLowSpend && adAttributedShare <= businessConfig.classificationRules.lowAdsContributionRatio) {
    tags.push('自然流强');
  }

  if (
    row.payAmount >= baselines.payAmount * 0.8 &&
    hasHighSpend &&
    adAttributedShare >= businessConfig.classificationRules.highAdsContributionRatio
  ) {
    tags.push('广告驱动');
  }

  if (refundRate >= baselines.refundRate * businessConfig.classificationRules.refundHighRatio) {
    tags.push('高退款');
  }

  if (hasHighSpend && hasLowRoi) {
    tags.push('高消耗低产出');
  }

  return tags;
}

export class AnalyticsService {
  static async getFilters() {
    await duckDbClient.init();
    const periods = await duckDbClient.query<{
      periodLabel: string;
      periodStart: string | null;
      periodEnd: string | null;
      periodType: string;
      hasProductData: boolean;
      hasRefundData: boolean;
    }>(
      `
      SELECT
        period_label AS periodLabel,
        MAX(period_start) AS periodStart,
        MAX(period_end) AS periodEnd,
        MAX(period_type) AS periodType,
        MAX(has_product_data) > 0 AS hasProductData,
        MAX(has_refund_data) > 0 AS hasRefundData
      FROM (
        SELECT period_label, period_start, period_end, period_type, 1 AS has_product_data, 0 AS has_refund_data FROM fact_product_period
        UNION ALL
        SELECT period_label, period_start, period_end, period_type, 0 AS has_product_data, 1 AS has_refund_data FROM fact_refund_period
      )
      GROUP BY period_label
      ORDER BY period_end DESC NULLS LAST, period_label DESC
      `
    );

    const sourceSheetRows = await duckDbClient.query<{ sourceSheet: string }>(
      `
      SELECT DISTINCT source_sheet AS sourceSheet
      FROM (
        SELECT source_sheet FROM fact_product_period
        UNION
        SELECT source_sheet FROM fact_refund_period
      )
      WHERE source_sheet IS NOT NULL AND source_sheet <> ''
      ORDER BY source_sheet
      `
    );

    return {
      periods,
      sourceSheets: sourceSheetRows.map((item) => item.sourceSheet)
    };
  }

  static async getDashboard(filters: FilterState): Promise<DashboardPayload> {
    await duckDbClient.init();
    const params = getPeriodParams(filters);

    const metricsRows = await duckDbClient.query<OverviewMetrics>(
      `
      SELECT
        COALESCE((
          SELECT SUM(pay_amount)
          FROM fact_product_period
          WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
            AND ($periodType = 'all' OR period_type = $periodType)
            AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
        ), 0) AS totalPayAmount,
        COALESCE((
          SELECT SUM(ad_cost)
          FROM fact_product_period
          WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
            AND ($periodType = 'all' OR period_type = $periodType)
            AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
        ), 0) AS totalAdCost,
        CASE
          WHEN COALESCE((
            SELECT SUM(ad_cost)
            FROM fact_product_period
            WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
              AND ($periodType = 'all' OR period_type = $periodType)
              AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
          ), 0) = 0 THEN 0
          ELSE
            COALESCE((
              SELECT SUM(total_gmv)
              FROM fact_product_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
            / NULLIF((
              SELECT SUM(ad_cost)
              FROM fact_product_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
        END AS roi,
        CASE
          WHEN COALESCE((
            SELECT SUM(pay_amount)
            FROM fact_refund_period
            WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
              AND ($periodType = 'all' OR period_type = $periodType)
              AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
          ), 0) = 0 THEN 0
          ELSE
            COALESCE((
              SELECT SUM(refund_total_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
            / NULLIF((
              SELECT SUM(pay_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
        END AS totalRefundRate,
        CASE
          WHEN COALESCE((
            SELECT SUM(pay_amount)
            FROM fact_refund_period
            WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
              AND ($periodType = 'all' OR period_type = $periodType)
              AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
          ), 0) = 0 THEN 0
          ELSE
            COALESCE((
              SELECT SUM(refund_pre_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
            / NULLIF((
              SELECT SUM(pay_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
        END AS refundPreRate,
        CASE
          WHEN COALESCE((
            SELECT SUM(pay_amount)
            FROM fact_refund_period
            WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
              AND ($periodType = 'all' OR period_type = $periodType)
              AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
          ), 0) = 0 THEN 0
          ELSE
            COALESCE((
              SELECT SUM(refund_post_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
            / NULLIF((
              SELECT SUM(pay_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
        END AS refundPostRate,
        CASE
          WHEN COALESCE((
            SELECT SUM(pay_amount)
            FROM fact_refund_period
            WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
              AND ($periodType = 'all' OR period_type = $periodType)
              AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
          ), 0) = 0 THEN 0
          ELSE
            COALESCE((
              SELECT SUM(refund_aftersale_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
            / NULLIF((
              SELECT SUM(pay_amount)
              FROM fact_refund_period
              WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
                AND ($periodType = 'all' OR period_type = $periodType)
                AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
            ), 0)
        END AS refundAftersaleRate
      `,
      params
    );

    const trend = await duckDbClient.query<TrendPoint>(
      `
      WITH refund_period AS (
        SELECT period_label, SUM(refund_total_amount) AS refund_total_amount
        FROM fact_refund_period
        WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
          AND ($periodType = 'all' OR period_type = $periodType)
          AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
        GROUP BY period_label
      )
      SELECT
        p.period_label AS periodLabel,
        SUM(p.pay_amount) AS payAmount,
        SUM(p.ad_cost) AS adCost,
        SUM(p.total_gmv) AS totalGmv,
        COALESCE(MAX(r.refund_total_amount), 0) AS refundTotalAmount,
        CASE WHEN SUM(p.ad_cost) = 0 THEN 0 ELSE SUM(p.total_gmv) / SUM(p.ad_cost) END AS roi
      FROM fact_product_period p
      LEFT JOIN refund_period r
        ON p.period_label = r.period_label
      WHERE ($periodLabel IS NULL OR p.period_label = $periodLabel)
        AND ($periodType = 'all' OR p.period_type = $periodType)
        AND ($sourceSheet IS NULL OR p.source_sheet = $sourceSheet)
        AND (p.product_name ILIKE $keyword OR p.product_code_norm ILIKE $keyword)
      GROUP BY p.period_label
      ORDER BY MAX(p.period_end) ASC NULLS LAST, p.period_label ASC
      `,
      params
    );

    const ranking = await duckDbClient.query<any>(
      `
      SELECT
        p.product_id AS productId,
        p.product_code_norm AS productCodeNorm,
        p.product_name AS productName,
        COALESCE(i.image_path, '') AS imagePath,
        SUM(p.pay_amount) AS payAmount,
        SUM(p.ad_cost) AS adCost,
        SUM(p.direct_gmv) AS directGmv,
        SUM(p.indirect_gmv) AS indirectGmv,
        SUM(p.total_gmv) AS totalGmv,
        CASE WHEN SUM(p.ad_cost) = 0 THEN 0 ELSE SUM(p.total_gmv) / SUM(p.ad_cost) END AS roi,
        SUM(p.pay_qty) AS payQty
      FROM fact_product_period p
      LEFT JOIN dim_product_image i
        ON p.product_code_norm = i.product_code_norm AND i.is_primary = true
      WHERE ($periodLabel IS NULL OR p.period_label = $periodLabel)
        AND ($periodType = 'all' OR p.period_type = $periodType)
        AND ($sourceSheet IS NULL OR p.source_sheet = $sourceSheet)
        AND (p.product_name ILIKE $keyword OR p.product_code_norm ILIKE $keyword)
      GROUP BY 1, 2, 3, 4
      ORDER BY payAmount DESC
      LIMIT 15
      `,
      params
    );

    const normalizedRanking = ranking.map((row) => ({
      productId: row.productId,
      productCodeNorm: row.productCodeNorm,
      productName: row.productName,
      imagePath: row.imagePath,
      payAmount: Number(row.payAmount || 0),
      adCost: Number(row.adCost || 0),
      directGmv: Number(row.directGmv || 0),
      indirectGmv: Number(row.indirectGmv || 0),
      totalGmv: Number(row.totalGmv || 0),
      roi: Number(row.roi || 0),
      payQty: Number(row.payQty || 0),
      adAttributedShare: safeRatio(Number(row.totalGmv || 0), Number(row.payAmount || 0))
    }));

    const quadrant = normalizedRanking.map((row) => ({
      productId: row.productId,
      productCodeNorm: row.productCodeNorm,
      productName: row.productName,
      spend: row.adCost,
      payAmount: row.payAmount,
      bubbleSize: row.payQty,
      roi: row.roi,
      imagePath: row.imagePath
    }));

    return {
      metrics: metricsRows[0] ?? {
        totalPayAmount: 0,
        totalAdCost: 0,
        roi: 0,
        totalRefundRate: 0,
        refundPreRate: 0,
        refundPostRate: 0,
        refundAftersaleRate: 0
      },
      trend,
      ranking: normalizedRanking,
      quadrant
    };
  }

  static async getProducts(filters: FilterState): Promise<ProductTableItem[]> {
    await duckDbClient.init();
    const params = getPeriodParams(filters);

    const rows = await duckDbClient.query<any>(
      `
      WITH refund_agg AS (
        SELECT
          product_code_norm,
          period_label,
          SUM(refund_pre_amount) AS refund_pre_amount,
          SUM(refund_post_amount) AS refund_post_amount,
          SUM(refund_aftersale_amount) AS refund_aftersale_amount,
          SUM(pay_amount) AS refund_pay_amount
        FROM fact_refund_period
        WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
          AND ($periodType = 'all' OR period_type = $periodType)
          AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
        GROUP BY 1, 2
      ),
      base AS (
        SELECT
          p.product_id AS productId,
          p.product_code_norm AS productCodeNorm,
          p.product_name AS productName,
          COALESCE(i.image_path, '') AS imagePath,
          p.period_label AS periodLabel,
          p.pay_amount AS payAmount,
          p.ad_cost AS adCost,
          p.direct_gmv AS directGmv,
          p.indirect_gmv AS indirectGmv,
          p.total_gmv AS totalGmv,
          p.roi AS roi,
          p.pay_qty AS payQty,
          p.success_refund_amount AS successRefundAmount,
          CASE WHEN r.refund_pay_amount = 0 THEN 0 ELSE r.refund_pre_amount / r.refund_pay_amount END AS refundPreRate,
          CASE WHEN r.refund_pay_amount = 0 THEN 0 ELSE r.refund_post_amount / r.refund_pay_amount END AS refundPostRate,
          CASE WHEN r.refund_pay_amount = 0 THEN 0 ELSE r.refund_aftersale_amount / r.refund_pay_amount END AS refundAftersaleRate,
          LAG(p.pay_amount) OVER (PARTITION BY p.product_code_norm ORDER BY p.period_end) AS prevPayAmount
        FROM fact_product_period p
        LEFT JOIN refund_agg r
          ON p.product_code_norm = r.product_code_norm AND p.period_label = r.period_label
        LEFT JOIN dim_product_image i
          ON p.product_code_norm = i.product_code_norm AND i.is_primary = true
        WHERE ($periodLabel IS NULL OR p.period_label = $periodLabel)
          AND ($periodType = 'all' OR p.period_type = $periodType)
          AND ($sourceSheet IS NULL OR p.source_sheet = $sourceSheet)
          AND (p.product_name ILIKE $keyword OR p.product_code_norm ILIKE $keyword)
      )
      SELECT * FROM base
      ORDER BY payAmount DESC
      `,
      params
    );

    const numericRows = rows.map((row) => ({
      ...row,
      payAmount: Number(row.payAmount || 0),
      adCost: Number(row.adCost || 0),
      directGmv: Number(row.directGmv || 0),
      indirectGmv: Number(row.indirectGmv || 0),
      totalGmv: Number(row.totalGmv || 0),
      roi: Number(row.roi || 0),
      payQty: Number(row.payQty || 0),
      successRefundAmount: Number(row.successRefundAmount || 0),
      refundPreRate: Number(row.refundPreRate || 0),
      refundPostRate: Number(row.refundPostRate || 0),
      refundAftersaleRate: Number(row.refundAftersaleRate || 0),
      prevPayAmount: Number(row.prevPayAmount || 0)
    }));

    const baselines = {
      payAmount: getMedian(numericRows.map((row) => row.payAmount)),
      adCost: getMedian(numericRows.map((row) => row.adCost)),
      roi: Math.max(getMedian(numericRows.map((row) => row.roi)), 0.01),
      refundRate: Math.max(
        getMedian(numericRows.map((row) => row.refundPreRate + row.refundPostRate + row.refundAftersaleRate)),
        0.01
      )
    };

    return numericRows.map((row) => {
      const payload: ProductTableItem = {
        productId: row.productId,
        productCodeNorm: row.productCodeNorm,
        productName: row.productName,
        imagePath: row.imagePath,
        payAmount: row.payAmount,
        adCost: row.adCost,
        directGmv: row.directGmv,
        indirectGmv: row.indirectGmv,
        totalGmv: row.totalGmv,
        roi: row.roi,
        payQty: row.payQty,
        adAttributedShare: safeRatio(row.totalGmv, row.payAmount),
        successRefundAmount: row.successRefundAmount,
        refundPreRate: row.refundPreRate,
        refundPostRate: row.refundPostRate,
        refundAftersaleRate: row.refundAftersaleRate,
        momChange: compareMom(row.payAmount, row.prevPayAmount),
        tags: []
      };

      payload.tags = classifyRow(payload, baselines);
      return payload;
    });
  }

  static async getMarketing(filters: FilterState): Promise<MarketingEfficiency> {
    await duckDbClient.init();
    const params = getPeriodParams(filters);
    const dashboard = await this.getDashboard(filters);
    const products = await this.getProducts(filters);

    const summaryRows = await duckDbClient.query<{ impressions: number; clicks: number; totalGmv: number; adCost: number }>(
      `
      SELECT
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(total_gmv) AS totalGmv,
        SUM(ad_cost) AS adCost
      FROM fact_product_period
      WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
        AND ($periodType = 'all' OR period_type = $periodType)
        AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
      `,
      params
    );

    const summary = summaryRows[0] ?? { impressions: 0, clicks: 0, totalGmv: 0, adCost: 0 };

    return {
      kpis: {
        adCost: Number(summary.adCost || 0),
        adRevenue: Number(summary.totalGmv || 0),
        roi: safeRatio(Number(summary.totalGmv || 0), Number(summary.adCost || 0)),
        cpc: safeRatio(Number(summary.adCost || 0), Number(summary.clicks || 0)),
        ctr: safeRatio(Number(summary.clicks || 0), Number(summary.impressions || 0))
      },
      trend: dashboard.trend,
      comparison: dashboard.trend,
      quadrant: products.slice(0, 60).map((item) => ({
        productId: item.productId,
        productCodeNorm: item.productCodeNorm,
        productName: item.productName,
        spend: item.adCost,
        payAmount: item.payAmount,
        bubbleSize: item.payQty,
        roi: item.roi,
        imagePath: item.imagePath
      })),
      naturalStrong: products.filter((item) => item.tags.includes('自然流强')).slice(0, 20),
      adsDriven: products.filter((item) => item.tags.includes('广告驱动')).slice(0, 20),
      highSpendLowOutput: products.filter((item) => item.tags.includes('高消耗低产出')).slice(0, 20)
    };
  }

  static async getRefundDiagnostics(filters: FilterState): Promise<RefundDiagnostics> {
    await duckDbClient.init();
    const params = getPeriodParams(filters);
    const products = await this.getProducts(filters);

    const rows = await duckDbClient.query<{ avgPreRate: number; avgPostRate: number; avgAftersaleRate: number }>(
      `
      SELECT
        CASE WHEN SUM(pay_amount) = 0 THEN 0 ELSE SUM(refund_pre_amount) / SUM(pay_amount) END AS avgPreRate,
        CASE WHEN SUM(pay_amount) = 0 THEN 0 ELSE SUM(refund_post_amount) / SUM(pay_amount) END AS avgPostRate,
        CASE WHEN SUM(pay_amount) = 0 THEN 0 ELSE SUM(refund_aftersale_amount) / SUM(pay_amount) END AS avgAftersaleRate
      FROM fact_refund_period
      WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
        AND ($periodType = 'all' OR period_type = $periodType)
        AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
      `,
      params
    );

    const avg = rows[0] ?? { avgPreRate: 0, avgPostRate: 0, avgAftersaleRate: 0 };

    const structureTrend = await duckDbClient.query<TrendPoint>(
      `
      SELECT
        period_label AS periodLabel,
        SUM(pay_amount) AS payAmount,
        SUM(refund_pre_amount) AS adCost,
        SUM(refund_post_amount) AS totalGmv,
        SUM(refund_aftersale_amount) AS refundTotalAmount
      FROM fact_refund_period
      WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
        AND ($periodType = 'all' OR period_type = $periodType)
        AND ($sourceSheet IS NULL OR source_sheet = $sourceSheet)
      GROUP BY period_label
      ORDER BY MAX(period_end) ASC NULLS LAST, period_label ASC
      `,
      params
    );

    return {
      avgPreRate: Number(avg.avgPreRate || 0),
      avgPostRate: Number(avg.avgPostRate || 0),
      avgAftersaleRate: Number(avg.avgAftersaleRate || 0),
      preHighList: products.filter((item) => item.refundPreRate > Number(avg.avgPreRate || 0)),
      postHighList: products.filter((item) => item.refundPostRate > Number(avg.avgPostRate || 0)),
      aftersaleHighList: products.filter((item) => item.refundAftersaleRate > Number(avg.avgAftersaleRate || 0)),
      tripleHighList: products.filter(
        (item) =>
          item.refundPreRate > Number(avg.avgPreRate || 0) &&
          item.refundPostRate > Number(avg.avgPostRate || 0) &&
          item.refundAftersaleRate > Number(avg.avgAftersaleRate || 0)
      ),
      structureTrend
    };
  }

  static async getRefundPeriodComparison(filters: FilterState): Promise<RefundPeriodComparisonRow[]> {
    const products = await this.getProducts(filters);

    return products.slice(0, 50).map((item) => {
      const previousPayAmount = item.momChange !== null && item.momChange !== -1 ? item.payAmount / (1 + item.momChange) : 0;
      const currentRefundRate = item.refundPreRate + item.refundPostRate + item.refundAftersaleRate;
      const previousRefundRate = item.successRefundAmount ? item.successRefundAmount / (item.payAmount || 1) : 0;

      return {
        productCodeNorm: item.productCodeNorm,
        productName: item.productName,
        imagePath: item.imagePath,
        currentPayAmount: item.payAmount,
        previousPayAmount,
        payMom: item.momChange,
        currentRefundRate,
        previousRefundRate,
        refundRateDiff: currentRefundRate - previousRefundRate
      };
    });
  }

  static async getProductDetail(productCodeNorm: string): Promise<ProductDetail> {
    await duckDbClient.init();
    const productRows = await this.getProducts({});
    const product = productRows.find((item) => item.productCodeNorm === productCodeNorm) ?? null;

    const trend = await duckDbClient.query<TrendPoint>(
      `
      SELECT
        period_label AS periodLabel,
        SUM(pay_amount) AS payAmount,
        SUM(ad_cost) AS adCost,
        SUM(total_gmv) AS totalGmv
      FROM fact_product_period
      WHERE product_code_norm = $productCodeNorm
      GROUP BY period_label
      ORDER BY MAX(period_end) ASC NULLS LAST, period_label ASC
      `,
      { productCodeNorm }
    );

    const refundRows = await duckDbClient.query<{ pre: number; post: number; aftersale: number }>(
      `
      SELECT
        SUM(refund_pre_amount) AS pre,
        SUM(refund_post_amount) AS post,
        SUM(refund_aftersale_amount) AS aftersale
      FROM fact_refund_period
      WHERE product_code_norm = $productCodeNorm
      `,
      { productCodeNorm }
    );

    return {
      product,
      trend,
      refundStructure: refundRows[0] ?? { pre: 0, post: 0, aftersale: 0 }
    };
  }
}
