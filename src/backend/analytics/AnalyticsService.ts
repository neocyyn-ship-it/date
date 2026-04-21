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
  if (!previousValue) return null;
  return (currentValue - previousValue) / previousValue;
}

function classifyRow(row: ProductTableItem, medians: { spend: number; roi: number; adShare: number; refund: number }) {
  const tags: string[] = [];
  const adShare = safeRatio(row.adCost, row.payAmount || row.totalGmv || 1);
  if (
    row.payAmount >= medians.spend &&
    adShare <= medians.adShare * businessConfig.classificationRules.lowAdsContributionRatio
  ) {
    tags.push('自然流强');
  }
  if (row.adCost >= medians.spend && adShare >= medians.adShare * businessConfig.classificationRules.highAdsContributionRatio) {
    tags.push('广告驱动');
  }
  if (row.refundPreRate + row.refundPostRate + row.refundAftersaleRate >= medians.refund * businessConfig.classificationRules.refundHighRatio) {
    tags.push('高退款');
  }
  if (row.adCost >= medians.spend && row.roi <= medians.roi * businessConfig.classificationRules.lowRoiRatio) {
    tags.push('高消耗低产出');
  }
  return tags;
}

export class AnalyticsService {
  static async getFilters() {
    await duckDbClient.init();
    const periods = await duckDbClient.query<{ periodLabel: string; periodStart: string | null; periodEnd: string | null; periodType: string }>(
      `
      SELECT DISTINCT period_label AS periodLabel, period_start AS periodStart, period_end AS periodEnd, period_type AS periodType
      FROM (
        SELECT period_label, period_start, period_end, period_type FROM fact_product_period
        UNION
        SELECT period_label, period_start, period_end, period_type FROM fact_refund_period
      )
      ORDER BY period_end DESC NULLS LAST, period_label DESC
      `
    );
    return { periods };
  }

  static async getDashboard(filters: FilterState): Promise<DashboardPayload> {
    await duckDbClient.init();
    const metricsRows = await duckDbClient.query<OverviewMetrics>(
      `
      SELECT
        COALESCE((SELECT SUM(pay_amount) FROM fact_product_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) AS totalPayAmount,
        COALESCE((SELECT SUM(ad_cost) FROM fact_product_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) AS totalAdCost,
        CASE
          WHEN COALESCE((SELECT SUM(ad_cost) FROM fact_product_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) = 0
            THEN 0
          ELSE
            COALESCE((SELECT SUM(total_gmv) FROM fact_product_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
            / NULLIF((SELECT SUM(ad_cost) FROM fact_product_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
        END AS roi,
        CASE
          WHEN COALESCE((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) = 0
            THEN 0
          ELSE
            COALESCE((SELECT SUM(refund_total_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
            / NULLIF((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
        END AS totalRefundRate,
        CASE
          WHEN COALESCE((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) = 0
            THEN 0
          ELSE
            COALESCE((SELECT SUM(refund_pre_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
            / NULLIF((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
        END AS refundPreRate,
        CASE
          WHEN COALESCE((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) = 0
            THEN 0
          ELSE
            COALESCE((SELECT SUM(refund_post_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
            / NULLIF((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
        END AS refundPostRate,
        CASE
          WHEN COALESCE((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0) = 0
            THEN 0
          ELSE
            COALESCE((SELECT SUM(refund_aftersale_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
            / NULLIF((SELECT SUM(pay_amount) FROM fact_refund_period WHERE ($periodLabel IS NULL OR period_label = $periodLabel)), 0)
        END AS refundAftersaleRate
      `,
      { periodLabel: filters.periodLabel ?? null }
    );

    const trend = await duckDbClient.query<TrendPoint>(
      `
      SELECT
        p.period_label AS periodLabel,
        SUM(p.pay_amount) AS payAmount,
        SUM(p.ad_cost) AS adCost,
        SUM(p.total_gmv) AS totalGmv,
        COALESCE(SUM(r.refund_total_amount), 0) AS refundTotalAmount,
        CASE WHEN SUM(p.ad_cost) = 0 THEN 0 ELSE SUM(p.total_gmv) / SUM(p.ad_cost) END AS roi
      FROM fact_product_period p
      LEFT JOIN fact_refund_period r
        ON p.period_label = r.period_label AND p.product_code_norm = r.product_code_norm
      WHERE p.product_name ILIKE $keyword
      GROUP BY p.period_label
      ORDER BY MAX(p.period_end) ASC NULLS LAST, p.period_label ASC
      `,
      { keyword: sqlLikeKeyword(filters.keyword) }
    );

    const ranking = await duckDbClient.query(
      `
      SELECT
        p.product_id AS productId,
        p.product_code_norm AS productCodeNorm,
        p.product_name AS productName,
        COALESCE(i.image_path, '') AS imagePath,
        SUM(p.pay_amount) AS payAmount,
        SUM(p.ad_cost) AS adCost,
        SUM(p.total_gmv) AS totalGmv,
        CASE WHEN SUM(p.ad_cost) = 0 THEN 0 ELSE SUM(p.total_gmv) / SUM(p.ad_cost) END AS roi,
        SUM(p.pay_qty) AS payQty
      FROM fact_product_period p
      LEFT JOIN dim_product_image i ON p.product_code_norm = i.product_code_norm AND i.is_primary = true
      WHERE ($periodLabel IS NULL OR p.period_label = $periodLabel)
        AND p.product_name ILIKE $keyword
      GROUP BY 1, 2, 3, 4
      ORDER BY payAmount DESC
      LIMIT 12
      `,
      { periodLabel: filters.periodLabel ?? null, keyword: sqlLikeKeyword(filters.keyword) }
    );

    const quadrant = ranking.map((row: any) => ({
      productId: row.productId,
      productCodeNorm: row.productCodeNorm,
      productName: row.productName,
      spend: Number(row.adCost || 0),
      payAmount: Number(row.payAmount || 0),
      bubbleSize: Number(row.payQty || 0),
      roi: Number(row.roi || 0),
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
      ranking: ranking as any,
      quadrant
    };
  }

  static async getProducts(filters: FilterState): Promise<ProductTableItem[]> {
    await duckDbClient.init();
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
          AND p.product_name ILIKE $keyword
      )
      SELECT * FROM base
      ORDER BY payAmount DESC
      `,
      { periodLabel: filters.periodLabel ?? null, keyword: sqlLikeKeyword(filters.keyword) }
    );

    const numericRows = rows.map((row) => ({
      ...row,
      payAmount: Number(row.payAmount || 0),
      adCost: Number(row.adCost || 0),
      totalGmv: Number(row.totalGmv || 0),
      roi: Number(row.roi || 0),
      payQty: Number(row.payQty || 0),
      successRefundAmount: Number(row.successRefundAmount || 0),
      refundPreRate: Number(row.refundPreRate || 0),
      refundPostRate: Number(row.refundPostRate || 0),
      refundAftersaleRate: Number(row.refundAftersaleRate || 0),
      prevPayAmount: Number(row.prevPayAmount || 0)
    }));

    const sortedSpend = numericRows.map((row) => row.adCost).sort((a, b) => a - b);
    const sortedRoi = numericRows.map((row) => row.roi).sort((a, b) => a - b);
    const sortedRefund = numericRows.map((row) => row.refundPreRate + row.refundPostRate + row.refundAftersaleRate).sort((a, b) => a - b);
    const midpoint = Math.max(0, Math.floor(numericRows.length / 2) - 1);
    const medians = {
      spend: sortedSpend[midpoint] || 0,
      roi: sortedRoi[midpoint] || 0,
      adShare: 0.2,
      refund: sortedRefund[midpoint] || 0
    };

    return numericRows.map((row) => {
      const payload: ProductTableItem = {
        productId: row.productId,
        productCodeNorm: row.productCodeNorm,
        productName: row.productName,
        imagePath: row.imagePath,
        payAmount: row.payAmount,
        adCost: row.adCost,
        totalGmv: row.totalGmv,
        roi: row.roi,
        payQty: row.payQty,
        successRefundAmount: row.successRefundAmount,
        refundPreRate: row.refundPreRate,
        refundPostRate: row.refundPostRate,
        refundAftersaleRate: row.refundAftersaleRate,
        momChange: compareMom(row.payAmount, row.prevPayAmount),
        tags: []
      };
      payload.tags = classifyRow(payload, medians);
      return payload;
    });
  }

  static async getMarketing(filters: FilterState): Promise<MarketingEfficiency> {
    const dashboard = await this.getDashboard(filters);
    const products = await this.getProducts(filters);
    const totalClicks = products.reduce((sum, item) => sum + item.payQty, 0);
    const totalImpressionsRows = await duckDbClient.query<{ impressions: number; clicks: number; totalGmv: number; adCost: number }>(
      `
      SELECT SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(total_gmv) AS totalGmv, SUM(ad_cost) AS adCost
      FROM fact_product_period
      WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
      `,
      { periodLabel: filters.periodLabel ?? null }
    );
    const sumRow = totalImpressionsRows[0] ?? { impressions: 0, clicks: 0, totalGmv: 0, adCost: 0 };

    return {
      kpis: {
        adCost: Number(sumRow.adCost || 0),
        adRevenue: Number(sumRow.totalGmv || 0),
        roi: safeRatio(Number(sumRow.totalGmv || 0), Number(sumRow.adCost || 0)),
        cpc: safeRatio(Number(sumRow.adCost || 0), Number(totalClicks || 0)),
        ctr: safeRatio(Number(sumRow.clicks || 0), Number(sumRow.impressions || 0))
      },
      trend: dashboard.trend,
      comparison: dashboard.trend,
      quadrant: dashboard.quadrant,
      naturalStrong: products.filter((item) => item.tags.includes('自然流强')).slice(0, 20),
      adsDriven: products.filter((item) => item.tags.includes('广告驱动')).slice(0, 20),
      highSpendLowOutput: products.filter((item) => item.tags.includes('高消耗低产出')).slice(0, 20)
    };
  }

  static async getRefundDiagnostics(filters: FilterState): Promise<RefundDiagnostics> {
    const products = await this.getProducts(filters);
    const rows = await duckDbClient.query<{ avgPreRate: number; avgPostRate: number; avgAftersaleRate: number }>(
      `
      SELECT
        CASE WHEN SUM(pay_amount) = 0 THEN 0 ELSE SUM(refund_pre_amount) / SUM(pay_amount) END AS avgPreRate,
        CASE WHEN SUM(pay_amount) = 0 THEN 0 ELSE SUM(refund_post_amount) / SUM(pay_amount) END AS avgPostRate,
        CASE WHEN SUM(pay_amount) = 0 THEN 0 ELSE SUM(refund_aftersale_amount) / SUM(pay_amount) END AS avgAftersaleRate
      FROM fact_refund_period
      WHERE ($periodLabel IS NULL OR period_label = $periodLabel)
      `,
      { periodLabel: filters.periodLabel ?? null }
    );
    const avg = rows[0] ?? { avgPreRate: 0, avgPostRate: 0, avgAftersaleRate: 0 };
    const preHighList = products.filter((item) => item.refundPreRate > Number(avg.avgPreRate || 0));
    const postHighList = products.filter((item) => item.refundPostRate > Number(avg.avgPostRate || 0));
    const aftersaleHighList = products.filter((item) => item.refundAftersaleRate > Number(avg.avgAftersaleRate || 0));
    const tripleHighList = products.filter(
      (item) =>
        item.refundPreRate > Number(avg.avgPreRate || 0) &&
        item.refundPostRate > Number(avg.avgPostRate || 0) &&
        item.refundAftersaleRate > Number(avg.avgAftersaleRate || 0)
    );
    const structureTrend = await duckDbClient.query<TrendPoint>(
      `
      SELECT
        period_label AS periodLabel,
        SUM(pay_amount) AS payAmount,
        SUM(refund_pre_amount) AS adCost,
        SUM(refund_post_amount) AS totalGmv,
        SUM(refund_aftersale_amount) AS refundTotalAmount
      FROM fact_refund_period
      GROUP BY period_label
      ORDER BY MAX(period_end) ASC NULLS LAST, period_label ASC
      `
    );
    return { ...avg, preHighList, postHighList, aftersaleHighList, tripleHighList, structureTrend };
  }

  static async getRefundPeriodComparison(filters: FilterState): Promise<RefundPeriodComparisonRow[]> {
    const products = await this.getProducts(filters);
    return products.slice(0, 50).map((item) => ({
      productCodeNorm: item.productCodeNorm,
      productName: item.productName,
      imagePath: item.imagePath,
      currentPayAmount: item.payAmount,
      previousPayAmount: item.momChange && item.momChange !== -1 ? item.payAmount / (1 + item.momChange) : 0,
      payMom: item.momChange,
      currentRefundRate: item.refundPreRate + item.refundPostRate + item.refundAftersaleRate,
      previousRefundRate: item.successRefundAmount ? item.successRefundAmount / (item.payAmount || 1) : 0,
      refundRateDiff: (item.refundPreRate + item.refundPostRate + item.refundAftersaleRate) - (item.successRefundAmount ? item.successRefundAmount / (item.payAmount || 1) : 0)
    }));
  }

  static async getProductDetail(productCodeNorm: string): Promise<ProductDetail> {
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
