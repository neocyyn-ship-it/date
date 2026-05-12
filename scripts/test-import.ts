import { ImportBatchService } from '../src/backend/importers/ImportBatchService.ts';
import { AnalyticsService } from '../src/backend/analytics/AnalyticsService.ts';
import { duckDbClient } from '../src/backend/db/client.ts';

const files = [process.argv[2], process.argv[3]].filter(Boolean);
const imageDirectory = process.argv[4];

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

  const commit = await ImportBatchService.commitFiles(files, undefined, imageDirectory);
  console.log('COMMIT');
  console.log(JSON.stringify(commit, null, 2));

  const dashboard = await AnalyticsService.getDashboard({});
  const products = await AnalyticsService.getProducts({});
  const refunds = await AnalyticsService.getRefundDiagnostics({});
  const filters = await AnalyticsService.getFilters();
  const marketing = await AnalyticsService.getMarketing({});

  console.log('DASHBOARD_METRICS');
  console.log(JSON.stringify(dashboard.metrics, null, 2));
  console.log('FILTERS');
  console.log(JSON.stringify(filters, null, 2));
  console.log('PRODUCT_COUNT', products.length);
  console.log(
    'MARKETING_COUNTS',
    JSON.stringify(
      {
        naturalStrong: marketing.naturalStrong.length,
        adsDriven: marketing.adsDriven.length,
        highSpendLowOutput: marketing.highSpendLowOutput.length
      },
      null,
      2
    )
  );
  console.log('TRIPLE_HIGH_COUNT', refunds.tripleHighList.length);
  console.log('IMAGE_DIR', imageDirectory || '未提供');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
