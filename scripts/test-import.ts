import { ImportBatchService } from '../src/backend/importers/ImportBatchService.ts';
import { AnalyticsService } from '../src/backend/analytics/AnalyticsService.ts';
import { duckDbClient } from '../src/backend/db/client.ts';

const files = [process.argv[2], process.argv[3]].filter(Boolean);

if (files.length === 0) {
  console.error('请传入 Excel 文件路径。');
  process.exit(1);
}

async function main() {
  await duckDbClient.init();
  await duckDbClient.exec('DELETE FROM dim_product_image;');
  await duckDbClient.exec('DELETE FROM dim_product;');
  await duckDbClient.exec('DELETE FROM fact_product_period;');
  await duckDbClient.exec('DELETE FROM fact_refund_period;');
  await duckDbClient.exec('DELETE FROM import_batch;');

  const preview = await ImportBatchService.previewFiles(files);
  console.log('PREVIEW');
  console.log(JSON.stringify(preview, null, 2));

  const commit = await ImportBatchService.commitFiles(files);
  console.log('COMMIT');
  console.log(JSON.stringify(commit, null, 2));

  const dashboard = await AnalyticsService.getDashboard({});
  const products = await AnalyticsService.getProducts({});
  const refunds = await AnalyticsService.getRefundDiagnostics({});

  console.log('DASHBOARD_METRICS');
  console.log(JSON.stringify(dashboard.metrics, null, 2));
  console.log('PRODUCT_COUNT', products.length);
  console.log('TRIPLE_HIGH_COUNT', refunds.tripleHighList.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
