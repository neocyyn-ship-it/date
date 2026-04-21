import { randomUUID } from 'node:crypto';
import { duckDbClient } from '@backend/db/client';
import { ImageMappingService } from '@backend/images/ImageMappingService';
import { ExcelImporterService } from '@backend/importers/ExcelImporterService';
import type { ImportBatch, ImportCommitResult, ImportPreviewResult, ProductFact, RefundFact, SourceType } from '@shared/types';

function nowText() {
  return new Date().toISOString();
}

async function upsertRefundRows(batchId: string, rows: RefundFact[]) {
  let replaced = 0;
  let inserted = 0;
  for (const row of rows) {
    const exists = await duckDbClient.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM fact_refund_period WHERE period_label = $periodLabel AND product_code_norm = $productCodeNorm`,
      { periodLabel: row.periodLabel, productCodeNorm: row.productCodeNorm }
    );
    if (Number(exists[0]?.cnt || 0) > 0) {
      replaced += 1;
      await duckDbClient.exec(
        `DELETE FROM fact_refund_period WHERE period_label = $periodLabel AND product_code_norm = $productCodeNorm`,
        { periodLabel: row.periodLabel, productCodeNorm: row.productCodeNorm }
      );
    } else {
      inserted += 1;
    }

    await duckDbClient.exec(
      `
      INSERT INTO fact_refund_period (
        id, batch_id, period_label, period_start, period_end, period_type,
        product_code_raw, product_code_norm, product_name, spend, pay_amount, sales_qty,
        refund_pre_amount, refund_pre_rate, refund_post_amount, refund_post_rate,
        refund_aftersale_amount, refund_aftersale_rate, refund_total_amount, refund_total_rate, source_sheet
      ) VALUES (
        $id, $batchId, $periodLabel, $periodStart, $periodEnd, $periodType,
        $productCodeRaw, $productCodeNorm, $productName, $spend, $payAmount, $salesQty,
        $refundPreAmount, $refundPreRate, $refundPostAmount, $refundPostRate,
        $refundAftersaleAmount, $refundAftersaleRate, $refundTotalAmount, $refundTotalRate, $sourceSheet
      )
      `,
      { ...row, batchId }
    );

    await duckDbClient.exec(
      `
      INSERT INTO dim_product (product_id, product_code_raw, product_code_norm, product_name, category, brand, status, created_at, updated_at)
      VALUES ($productId, $productCodeRaw, $productCodeNorm, $productName, '', '', 'active', $createdAt, $updatedAt)
      ON CONFLICT (product_code_norm) DO UPDATE SET
        product_name = excluded.product_name,
        updated_at = excluded.updated_at
      `,
      {
        productId: '',
        productCodeRaw: row.productCodeRaw,
        productCodeNorm: row.productCodeNorm,
        productName: row.productName,
        createdAt: nowText(),
        updatedAt: nowText()
      }
    );
  }
  return { inserted, replaced };
}

async function upsertProductRows(batchId: string, rows: ProductFact[]) {
  let replaced = 0;
  let inserted = 0;
  for (const row of rows) {
    const exists = await duckDbClient.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM fact_product_period WHERE period_label = $periodLabel AND product_code_norm = $productCodeNorm AND product_id = $productId`,
      { periodLabel: row.periodLabel, productCodeNorm: row.productCodeNorm, productId: row.productId }
    );
    if (Number(exists[0]?.cnt || 0) > 0) {
      replaced += 1;
      await duckDbClient.exec(
        `DELETE FROM fact_product_period WHERE period_label = $periodLabel AND product_code_norm = $productCodeNorm AND product_id = $productId`,
        { periodLabel: row.periodLabel, productCodeNorm: row.productCodeNorm, productId: row.productId }
      );
    } else {
      inserted += 1;
    }

    await duckDbClient.exec(
      `
      INSERT INTO fact_product_period (
        id, batch_id, period_label, period_start, period_end, period_type, product_id, product_code_raw, product_code_norm,
        product_name, visitors, fav_users, cart_qty, pay_buyers, pay_qty, pay_amount, success_refund_amount, impressions, clicks,
        ad_cost, direct_gmv, indirect_gmv, total_gmv, roi, source_sheet, image_url
      ) VALUES (
        $id, $batchId, $periodLabel, $periodStart, $periodEnd, $periodType, $productId, $productCodeRaw, $productCodeNorm,
        $productName, $visitors, $favUsers, $cartQty, $payBuyers, $payQty, $payAmount, $successRefundAmount, $impressions, $clicks,
        $adCost, $directGmv, $indirectGmv, $totalGmv, $roi, $sourceSheet, $imageUrl
      )
      `,
      { ...row, batchId }
    );

    await duckDbClient.exec(
      `
      INSERT INTO dim_product (product_id, product_code_raw, product_code_norm, product_name, category, brand, status, created_at, updated_at)
      VALUES ($productId, $productCodeRaw, $productCodeNorm, $productName, '', '', 'active', $createdAt, $updatedAt)
      ON CONFLICT (product_code_norm) DO UPDATE SET
        product_id = excluded.product_id,
        product_name = excluded.product_name,
        updated_at = excluded.updated_at
      `,
      {
        productId: row.productId,
        productCodeRaw: row.productCodeRaw,
        productCodeNorm: row.productCodeNorm,
        productName: row.productName,
        createdAt: nowText(),
        updatedAt: nowText()
      }
    );

    if (row.imageUrl) {
      await duckDbClient.exec(
        `
        DELETE FROM dim_product_image WHERE product_code_norm = $productCodeNorm;
        `,
        { productCodeNorm: row.productCodeNorm }
      );
      await duckDbClient.exec(
        `
        INSERT INTO dim_product_image (id, product_id, product_code_norm, image_path, image_source, is_primary, created_at)
        VALUES ($id, $productId, $productCodeNorm, $imagePath, $imageSource, true, $createdAt)
        `,
        {
          id: randomUUID(),
          productId: row.productId,
          productCodeNorm: row.productCodeNorm,
          imagePath: row.imageUrl,
          imageSource: 'excel_or_mapping',
          createdAt: nowText()
        }
      );
    }
  }
  return { inserted, replaced };
}

function applyLocalImages(rows: ProductFact[], imageDirectory?: string) {
  if (!imageDirectory) return rows;
  const localMap = ImageMappingService.scanLocalDirectory(imageDirectory);
  return rows.map((row) => {
    if (row.imageUrl) return row;
    const picked = ImageMappingService.pickPrimaryImage(row.productCodeNorm, row.productId, row.imageUrl, localMap);
    return {
      ...row,
      imageUrl: picked.imagePath || row.imageUrl
    };
  });
}

export class ImportBatchService {
  static async previewFiles(filePaths: string[], overrides?: Record<string, string>) {
    await duckDbClient.init();
    return Promise.all(filePaths.map((filePath) => ExcelImporterService.preview(filePath, overrides)));
  }

  static async commitFiles(filePaths: string[], overrides?: Record<string, string>, imageDirectory?: string): Promise<ImportCommitResult[]> {
    await duckDbClient.init();
    const results: ImportCommitResult[] = [];

    for (const filePath of filePaths) {
      const preview: ImportPreviewResult = await ExcelImporterService.preview(filePath, overrides);
      const batchId = randomUUID();
      const batch: ImportBatch = {
        batchId,
        fileName: preview.fileName,
        fileHash: ExcelImporterService.fileHash(filePath),
        sourceType: preview.sourceType as SourceType,
        importedAt: nowText(),
        importStatus: 'pending',
        message: preview.message
      };

      await duckDbClient.exec(
        `
        INSERT INTO import_batch (batch_id, file_name, file_hash, source_type, imported_at, import_status, message, inserted_count, replaced_count)
        VALUES ($batchId, $fileName, $fileHash, $sourceType, $importedAt, $importStatus, $message, 0, 0)
        `,
        {
          batchId: batch.batchId,
          fileName: batch.fileName,
          fileHash: batch.fileHash,
          sourceType: batch.sourceType,
          importedAt: batch.importedAt,
          importStatus: batch.importStatus,
          message: batch.message
        }
      );

      try {
        let insertedCount = 0;
        let replacedCount = 0;
        if (preview.sourceType === 'refund_template') {
          const rows = ExcelImporterService.parseRefundRecords(filePath, overrides);
          const outcome = await upsertRefundRows(batchId, rows);
          insertedCount = outcome.inserted;
          replacedCount = outcome.replaced;
        } else if (preview.sourceType === 'product_template') {
          const rows = applyLocalImages(ExcelImporterService.parseProductRecords(filePath, overrides), imageDirectory);
          const outcome = await upsertProductRows(batchId, rows);
          insertedCount = outcome.inserted;
          replacedCount = outcome.replaced;
        }

        await duckDbClient.exec(
          `
          UPDATE import_batch
          SET import_status = 'success', message = $message, inserted_count = $insertedCount, replaced_count = $replacedCount
          WHERE batch_id = $batchId
          `,
          {
            batchId,
            message: '导入成功',
            insertedCount,
            replacedCount
          }
        );

        results.push({
          batch: { ...batch, importStatus: 'success', insertedCount, replacedCount, message: '导入成功' },
          insertedCount,
          replacedCount,
          addedPeriods: preview.periodLabels,
          replacedPeriods: preview.periodLabels.filter(() => replacedCount > 0),
          errors: []
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知导入错误';
        await duckDbClient.exec(
          `UPDATE import_batch SET import_status = 'failed', message = $message WHERE batch_id = $batchId`,
          { batchId, message }
        );
        results.push({
          batch: { ...batch, importStatus: 'failed', message },
          insertedCount: 0,
          replacedCount: 0,
          addedPeriods: [],
          replacedPeriods: [],
          errors: [message]
        });
      }
    }

    return results;
  }

  static async getImportLogs() {
    await duckDbClient.init();
    return duckDbClient.query<ImportBatch>(
      `
      SELECT
        batch_id AS batchId,
        file_name AS fileName,
        file_hash AS fileHash,
        source_type AS sourceType,
        imported_at AS importedAt,
        import_status AS importStatus,
        message,
        inserted_count AS insertedCount,
        replaced_count AS replacedCount
      FROM import_batch
      ORDER BY imported_at DESC
      `
    );
  }
}
