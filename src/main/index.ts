import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalyticsService } from '@backend/analytics/AnalyticsService';
import { ImportBatchService } from '@backend/importers/ImportBatchService';
import { duckDbClient } from '@backend/db/client';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 860,
    show: false,
    title: '女装电商经营分析工作台',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.once('ready-to-show', () => win.show());

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

  ipcMain.handle('import:previewFiles', (_event, filePaths: string[], overrides?: Record<string, string>) =>
    ImportBatchService.previewFiles(filePaths, overrides)
  );
  ipcMain.handle('import:commitFiles', (_event, filePaths: string[], overrides?: Record<string, string>) =>
    ImportBatchService.commitFiles(filePaths, overrides)
  );
  ipcMain.handle('import:getLogs', () => ImportBatchService.getImportLogs());

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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
