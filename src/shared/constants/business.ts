export const APP_NAME = '女装电商经营分析工作台';

export const SOURCE_TYPES = {
  refund: 'refund_template',
  product: 'product_template',
  imageMapping: 'image_mapping_template',
  unknown: 'unknown_template'
} as const;

export const PERIOD_TYPES = {
  weeklyExact: 'weekly_exact',
  rangeExact: 'range_exact',
  rolling30d: 'rolling_30d',
  monthly: 'monthly',
  unknown: 'unknown'
} as const;

export const BUSINESS_TAGS = ['自然流强', '广告驱动', '高退款', '高消耗低产出'] as const;

export const TAG_COLORS: Record<string, string> = {
  自然流强: 'green',
  广告驱动: 'blue',
  高退款: 'volcano',
  高消耗低产出: 'gold'
};

export const DEFAULT_CLASSIFICATION_RULES = {
  lowSpendRatio: 0.35,
  highSpendRatio: 0.65,
  lowRoiRatio: 0.6,
  highRoiRatio: 1.25,
  lowAdsContributionRatio: 0.35,
  highAdsContributionRatio: 0.55,
  refundHighRatio: 1.2
};
