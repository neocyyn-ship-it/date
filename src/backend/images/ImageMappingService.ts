import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeProductCode } from '@backend/mappers/ProductCodeService';

export class ImageMappingService {
  static scanLocalDirectory(dirPath: string) {
    const result: Record<string, string> = {};
    const walk = (current: string) => {
      for (const item of readdirSync(current)) {
        const fullPath = join(current, item);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.(png|jpe?g|webp)$/i.test(item)) continue;
        const baseName = item.replace(/\.[^.]+$/, '');
        result[normalizeProductCode(baseName)] = fullPath;
      }
    };
    walk(dirPath);
    return result;
  }

  static pickPrimaryImage(
    productCodeNorm: string,
    productId: string,
    imageUrl?: string,
    localMap?: Record<string, string>,
    sheetMap?: Record<string, string>
  ) {
    if (imageUrl) return { imagePath: imageUrl, imageSource: 'excel_link' };
    if (sheetMap?.[productId]) return { imagePath: sheetMap[productId], imageSource: 'mapping_sheet' };
    if (sheetMap?.[productCodeNorm]) return { imagePath: sheetMap[productCodeNorm], imageSource: 'mapping_sheet' };
    if (localMap?.[productId]) return { imagePath: localMap[productId], imageSource: 'local_directory' };
    if (localMap?.[productCodeNorm]) return { imagePath: localMap[productCodeNorm], imageSource: 'local_directory' };
    return { imagePath: '', imageSource: 'none' };
  }
}
