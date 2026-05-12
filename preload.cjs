const { contextBridge, ipcRenderer } = require('electron');

const api = {
  importer: {
    selectFiles: () => ipcRenderer.invoke('import:selectFiles'),
    selectImageDirectory: () => ipcRenderer.invoke('import:selectImageDirectory'),
    previewFiles: (filePaths, overrides) => ipcRenderer.invoke('import:previewFiles', filePaths, overrides),
    commitFiles: (filePaths, overrides, imageDirectory) =>
      ipcRenderer.invoke('import:commitFiles', filePaths, overrides, imageDirectory),
    getImportLogs: () => ipcRenderer.invoke('import:getLogs'),
    scanImageDirectory: (dirPath) => ipcRenderer.invoke('import:scanImageDirectory', dirPath),
    loadSavedMappings: (sourceType) => ipcRenderer.invoke('import:loadSavedMappings', sourceType),
    saveMappings: (sourceType, mappings) => ipcRenderer.invoke('import:saveMappings', sourceType, mappings)
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
