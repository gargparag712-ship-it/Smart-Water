const { contextBridge, ipcRenderer } = require('electron');

// Keep this API deliberately small. Renderer code cannot access Node or the filesystem.
contextBridge.exposeInMainWorld('smartWater', {
  checkHealth: () => ipcRenderer.invoke('app:health-check'),
  listAssets: () => ipcRenderer.invoke('assets:list'),
  getAsset: (id) => ipcRenderer.invoke('assets:get', id),
  createAsset: (asset) => ipcRenderer.invoke('assets:create', asset),
  updateAsset: (id, asset) => ipcRenderer.invoke('assets:update', id, asset),
  deleteAsset: (id) => ipcRenderer.invoke('assets:delete', id),
  listInventoryItems: () => ipcRenderer.invoke('inventory:list'),
  getInventoryItem: (id) => ipcRenderer.invoke('inventory:get', id),
  createInventoryItem: (item) => ipcRenderer.invoke('inventory:create', item),
  updateInventoryItem: (id, item) => ipcRenderer.invoke('inventory:update', id, item),
  deleteInventoryItem: (id) => ipcRenderer.invoke('inventory:delete', id),
  listInventoryTransactions: (filters) => ipcRenderer.invoke('inventory:transactions', filters),
  stockIn: (movement) => ipcRenderer.invoke('inventory:stock-in', movement),
  stockOut: (movement) => ipcRenderer.invoke('inventory:stock-out', movement),
  listMaintenanceRecords: (filters) => ipcRenderer.invoke('maintenance:list', filters),
  getMaintenanceRecord: (id) => ipcRenderer.invoke('maintenance:get', id),
  createMaintenanceRecord: (record) => ipcRenderer.invoke('maintenance:create', record),
  updateMaintenanceRecord: (id, record) => ipcRenderer.invoke('maintenance:update', id, record),
  updateMaintenanceStatus: (id, transition) => ipcRenderer.invoke('maintenance:update-status', id, transition),
  listAssetMaintenanceHistory: (assetId) => ipcRenderer.invoke('maintenance:asset-history', assetId),
  listMaintenanceAssets: () => ipcRenderer.invoke('maintenance:assets'),
  getMaintenanceSummary: () => ipcRenderer.invoke('maintenance:summary'),
});
