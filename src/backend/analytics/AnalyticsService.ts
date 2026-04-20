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
}
