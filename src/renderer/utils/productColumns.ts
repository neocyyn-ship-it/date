export const PRODUCT_COLUMN_OPTIONS = [
  { label: '商品', value: 'product' },
  { label: '生参支付金额', value: 'payAmount' },
  { label: '阿里妈妈花费', value: 'adCost' },
  { label: '阿里妈妈投产比', value: 'roi' },
  { label: '广告成交占比', value: 'adAttributedShare' },
  { label: '广告成交金额', value: 'totalGmv' },
  { label: '成功退款金额', value: 'successRefundAmount' },
  { label: '发货前退款率', value: 'refundPreRate' },
  { label: '发货后退款率', value: 'refundPostRate' },
  { label: '售后退款率', value: 'refundAftersaleRate' },
  { label: '支付环比', value: 'momChange' },
  { label: '标签', value: 'tags' }
] as const;

export type ProductColumnKey = (typeof PRODUCT_COLUMN_OPTIONS)[number]['value'];

export const DEFAULT_PRODUCT_COLUMNS: ProductColumnKey[] = [
  'product',
  'payAmount',
  'adCost',
  'roi',
  'adAttributedShare',
  'successRefundAmount',
  'refundPreRate',
  'refundPostRate',
  'refundAftersaleRate',
  'momChange',
  'tags'
];
