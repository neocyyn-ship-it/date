import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalyticsService } from '@backend/analytics/AnalyticsService';
import { duckDbClient } from '@backend/db/client';
import { FieldMappingConfigService } from '@backend/importers/FieldMappingConfigService';
import { ImportBatchService } from '@backend/importers/ImportBatchService';
import type { SourceType } from '@shared/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolvePreloadPath() {
  const rootCjsPath = join(process.cwd(), 'preload.cjs');
  const mjsPath = join(__dirname, '../preload/index.mjs');
  const jsPath = join(__dirname, '../preload/index.js');

  if (existsSync(rootCjsPath)) {
    return rootCjsPath;
  }

  if (existsSync(mjsPath)) {
    return mjsPath;
  }

  return jsPath;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 860,
    show: false,
    title: '女装电商经营分析工作台',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  await duckDbClient.init();

  ipcMain.handle('import:selectFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 Excel 文件',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile', 'multiSelections']
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('import:selectImageDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择商品图片目录',
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('import:previewFiles', (_event, filePaths: string[], overrides?: Record<string, string>) =>
    ImportBatchService.previewFiles(filePaths, overrides)
  );
  ipcMain.handle('import:commitFiles', (_event, filePaths: string[], overrides?: Record<string, string>, imageDirectory?: string) =>
    ImportBatchService.commitFiles(filePaths, overrides, imageDirectory)
  );
  ipcMain.handle('import:getLogs', () => ImportBatchService.getImportLogs());
  ipcMain.handle('import:loadSavedMappings', (_event, sourceType: SourceType) =>
    FieldMappingConfigService.load(app.getPath('userData'), sourceType)
  );
  ipcMain.handle('import:saveMappings', (_event, sourceType: SourceType, mappings: Record<string, string>) => {
    FieldMappingConfigService.save(app.getPath('userData'), sourceType, mappings);
  });
  ipcMain.handle('import:scanImageDirectory', async (_event, dirPath: string) => {
    const { ImageMappingService } = await import('@backend/images/ImageMappingService');
    const mapping = ImageMappingService.scanLocalDirectory(dirPath);
    const entries = Object.entries(mapping);
    return {
      matchedCount: entries.length,
      samples: entries.slice(0, 20).map(([code, path]) => ({ code, path }))
    };
  });

  ipcMain.handle('analytics:getFilters', () => AnalyticsService.getFilters());
  ipcMain.handle('analytics:getDashboard', (_event, filters) => AnalyticsService.getDashboard(filters));
  ipcMain.handle('analytics:getMarketing', (_event, filters) => AnalyticsService.getMarketing(filters));
  ipcMain.handle('analytics:getRefundDiagnostics', (_event, filters) => AnalyticsService.getRefundDiagnostics(filters));
  ipcMain.handle('analytics:getRefundPeriodComparison', (_event, filters) => AnalyticsService.getRefundPeriodComparison(filters));
  ipcMain.handle('analytics:getProducts', (_event, filters) => AnalyticsService.getProducts(filters));
  ipcMain.handle('analytics:getProductDetail', (_event, productCodeNorm: string) => AnalyticsService.getProductDetail(productCodeNorm));

  ipcMain.handle('system:openExternal', (_event, target: string) => shell.openExternal(target));
  ipcMain.handle('system:getSampleFiles', () => [join(process.cwd(), 'samples-product.xls'), join(process.cwd(), 'samples-refund.xlsx')]);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
