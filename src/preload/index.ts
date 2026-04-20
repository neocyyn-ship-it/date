import { contextBridge, ipcRenderer } from 'electron';
import type { IEcomApi } from '@shared/types';

const api: IEcomApi = {
  importer: {
    selectFiles: () => ipcRenderer.invoke('import:selectFiles'),
    previewFiles: (filePaths, overrides) => ipcRenderer.invoke('import:previewFiles', filePaths, overrides),
    commitFiles: (filePaths, overrides) => ipcRenderer.invoke('import:commitFiles', filePaths, overrides),
    getImportLogs: () => ipcRenderer.invoke('import:getLogs')
  },
  analytics: {
    getFilters: () => ipcRenderer.invoke('analytics:getFilters'),
    getDashboard: (filters) => ipcRenderer.invoke('analytics:getDashboard', filters),
    getMarketing: (filters) => ipcRenderer.invoke('analytics:getMarketing', filters),
    getRefundDiagnostics: (filters) => ipcRenderer.invoke('analytics:getRefundDiagnostics', filters),
    getRefundPeriodComparison: (filters) => ipcRenderer.invoke('analytics:getRefundPeriodComparison', filters),
    getProducts: (filters) => ipcRenderer.invoke('analytics:getProducts', filters),
    getProductDetail: (productCodeNorm) => ipcRenderer.invoke('analytics:getProductDetail', productCodeNorm)
  },
  system: {
    openExternal: (target) => ipcRenderer.invoke('system:openExternal', target),
    getSampleFiles: () => ipcRenderer.invoke('system:getSampleFiles')
  }
};

contextBridge.exposeInMainWorld('ecomApi', api);
