export const initSchemaSql = `
CREATE TABLE IF NOT EXISTS import_batch (
  batch_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  source_type TEXT NOT NULL,
  imported_at TIMESTAMP NOT NULL,
  import_status TEXT NOT NULL,
  message TEXT,
  inserted_count INTEGER DEFAULT 0,
  replaced_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fact_refund_period (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  period_type TEXT NOT NULL,
  product_code_raw TEXT,
  product_code_norm TEXT,
  product_name TEXT,
  spend DOUBLE DEFAULT 0,
  pay_amount DOUBLE DEFAULT 0,
  sales_qty DOUBLE DEFAULT 0,
  refund_pre_amount DOUBLE DEFAULT 0,
  refund_pre_rate DOUBLE DEFAULT 0,
  refund_post_amount DOUBLE DEFAULT 0,
  refund_post_rate DOUBLE DEFAULT 0,
  refund_aftersale_amount DOUBLE DEFAULT 0,
  refund_aftersale_rate DOUBLE DEFAULT 0,
  refund_total_amount DOUBLE DEFAULT 0,
  refund_total_rate DOUBLE DEFAULT 0,
  source_sheet TEXT
);

CREATE TABLE IF NOT EXISTS fact_product_period (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  period_type TEXT NOT NULL,
  product_id TEXT,
  product_code_raw TEXT,
  product_code_norm TEXT,
  product_name TEXT,
  visitors DOUBLE DEFAULT 0,
  fav_users DOUBLE DEFAULT 0,
  cart_qty DOUBLE DEFAULT 0,
  pay_buyers DOUBLE DEFAULT 0,
  pay_qty DOUBLE DEFAULT 0,
  pay_amount DOUBLE DEFAULT 0,
  success_refund_amount DOUBLE DEFAULT 0,
  impressions DOUBLE DEFAULT 0,
  clicks DOUBLE DEFAULT 0,
  ad_cost DOUBLE DEFAULT 0,
  direct_gmv DOUBLE DEFAULT 0,
  indirect_gmv DOUBLE DEFAULT 0,
  total_gmv DOUBLE DEFAULT 0,
  roi DOUBLE DEFAULT 0,
  source_sheet TEXT,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS dim_product (
  product_id TEXT,
  product_code_raw TEXT,
  product_code_norm TEXT PRIMARY KEY,
  product_name TEXT,
  category TEXT,
  brand TEXT,
  status TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_product_image (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  product_code_norm TEXT,
  image_path TEXT NOT NULL,
  image_source TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refund_period_product ON fact_refund_period (period_label, product_code_norm);
CREATE INDEX IF NOT EXISTS idx_product_period_product ON fact_product_period (period_label, product_code_norm);
CREATE INDEX IF NOT EXISTS idx_product_image_product ON dim_product_image (product_code_norm, product_id);
`;
