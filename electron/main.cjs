const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { ensureStorage } = require('./storage.cjs');
const { AssetServiceError, createAssetService } = require('./assetsService.cjs');
const { InventoryServiceError, createInventoryService } = require('./inventoryService.cjs');
const { MaintenanceServiceError, createMaintenanceService } = require('./maintenanceService.cjs');
const { FinanceServiceError, createFinanceService } = require('./financeService.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');

let storageReady = false;
let assetService;
let inventoryService;
let maintenanceService;
let financeService;
const relatedDataQueue = createOperationQueue();

function createWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#f4f8f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.argv.includes('--dev')) {
    window.loadURL('http://127.0.0.1:5173');
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('app:health-check', async () => ({
  ok: storageReady,
  appName: app.getName(),
  storageReady,
  message: storageReady ? 'Electron communication is working.' : 'Local storage is not ready.',
}));

function registerAssetHandlers() {
  const handlers = {
    'assets:list': () => assetService.listAssets(),
    'assets:get': (id) => assetService.getAsset(id),
    'assets:create': (asset) => assetService.createAsset(asset),
    'assets:update': (id, asset) => assetService.updateAsset(id, asset),
    'assets:delete': (id) => assetService.deleteAsset(id),
  };

  for (const [channel, operation] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        if (!storageReady || !assetService) throw new Error('Storage is not ready.');
        return { ok: true, data: await operation(...args) };
      } catch (error) {
        if (!(error instanceof AssetServiceError)) {
          console.error(`SmartWater asset operation failed (${channel}):`, error);
        }
        const message = error instanceof AssetServiceError
          ? error.message
          : error instanceof SyntaxError
            ? 'The asset data file is malformed. No changes were saved.'
            : 'SmartWater could not read or save assets. Please try again.';
        return { ok: false, error: message };
      }
    });
  }
}

function registerInventoryHandlers() {
  const handlers = {
    'inventory:list': () => inventoryService.listItems(),
    'inventory:get': (id) => inventoryService.getItem(id),
    'inventory:create': (item) => inventoryService.createItem(item),
    'inventory:update': (id, item) => inventoryService.updateItem(id, item),
    'inventory:delete': (id) => inventoryService.deleteItem(id),
    'inventory:transactions': (filters) => inventoryService.listTransactions(filters),
    'inventory:stock-in': (movement) => inventoryService.stockIn(movement),
    'inventory:stock-out': (movement) => inventoryService.stockOut(movement),
  };

  for (const [channel, operation] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        if (!storageReady || !inventoryService) throw new Error('Storage is not ready.');
        return { ok: true, data: await operation(...args) };
      } catch (error) {
        if (!(error instanceof InventoryServiceError)) console.error(`SmartWater inventory operation failed (${channel}):`, error);
        const message = error instanceof InventoryServiceError
          ? error.message
          : error instanceof SyntaxError
            ? 'An inventory data file is malformed. No changes were saved.'
            : 'SmartWater could not read or save inventory. Please try again.';
        return { ok: false, error: message };
      }
    });
  }
}

function registerMaintenanceHandlers() {
  const handlers = {
    'maintenance:list': (filters) => maintenanceService.listRecords(filters),
    'maintenance:get': (id) => maintenanceService.getRecord(id),
    'maintenance:create': (record) => maintenanceService.createRecord(record),
    'maintenance:update': (id, record) => maintenanceService.updateRecord(id, record),
    'maintenance:update-status': (id, transition) => maintenanceService.updateStatus(id, transition),
    'maintenance:asset-history': (assetId) => maintenanceService.listAssetHistory(assetId),
    'maintenance:assets': () => maintenanceService.listAssets(),
    'maintenance:summary': () => maintenanceService.getSummary(),
  };
  for (const [channel, operation] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        if (!storageReady || !maintenanceService) throw new Error('Storage is not ready.');
        return { ok: true, data: await operation(...args) };
      } catch (error) {
        if (!(error instanceof MaintenanceServiceError)) console.error(`SmartWater maintenance operation failed (${channel}):`, error);
        const message = error instanceof MaintenanceServiceError
          ? error.message
          : error instanceof SyntaxError
            ? 'A maintenance data file is malformed. No changes were saved.'
            : 'SmartWater could not read or save maintenance records. Please try again.';
        return { ok: false, error: message };
      }
    });
  }
}

function registerFinanceHandlers() {
  const handlers = {
    'finance:list': (filters) => financeService.listTransactions(filters),
    'finance:get': (id) => financeService.getTransaction(id),
    'finance:create': (transaction) => financeService.createTransaction(transaction),
    'finance:update': (id, transaction) => financeService.updateTransaction(id, transaction),
    'finance:delete': (id) => financeService.deleteTransaction(id),
    'finance:summary': () => financeService.getSummary(),
    'finance:budgets:list': () => financeService.listBudgets(),
    'finance:budgets:create': (budget) => financeService.createBudget(budget),
    'finance:budgets:update': (id, budget) => financeService.updateBudget(id, budget),
    'finance:budgets:delete': (id) => financeService.deleteBudget(id),
    'finance:maintenance-orders': () => maintenanceService.listRecords(),
  };
  for (const [channel, operation] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        if (!storageReady || !financeService) throw new Error('Storage is not ready.');
        return { ok: true, data: await operation(...args) };
      } catch (error) {
        if (!(error instanceof FinanceServiceError)) console.error(`SmartWater finance operation failed (${channel}):`, error);
        const message = error instanceof FinanceServiceError
          ? error.message
          : error instanceof SyntaxError
            ? 'A finance data file is malformed. No changes were saved.'
            : 'SmartWater could not read or save finance records. Please try again.';
        return { ok: false, error: message };
      }
    });
  }
}

app.whenReady().then(async () => {
  try {
    const dataDirectory = path.join(app.getPath('userData'), 'data');
    await ensureStorage(dataDirectory);
    assetService = createAssetService(dataDirectory, relatedDataQueue);
    inventoryService = createInventoryService(dataDirectory);
    maintenanceService = createMaintenanceService(dataDirectory, relatedDataQueue);
    financeService = createFinanceService(dataDirectory, relatedDataQueue);
    registerAssetHandlers();
    registerInventoryHandlers();
    registerMaintenanceHandlers();
    registerFinanceHandlers();
    storageReady = true;
    createWindow();
  } catch (error) {
    console.error('SmartWater could not initialize local storage:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && storageReady) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
