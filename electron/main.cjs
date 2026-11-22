const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fileURLToPath } = require('node:url');
const { ensureStorage } = require('./storage.cjs');
const { AssetServiceError, createAssetService } = require('./assetsService.cjs');
const { InventoryServiceError, createInventoryService } = require('./inventoryService.cjs');
const { MaintenanceServiceError, createMaintenanceService } = require('./maintenanceService.cjs');
const { FinanceServiceError, createFinanceService } = require('./financeService.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');
const { SupplierServiceError, createSupplierService } = require('./supplierService.cjs');
const { ReportsServiceError, getReportData } = require('./reportsService.cjs');
const { buildPdfHtml } = require('./pdfReport.cjs');
const { BackupServiceError, createBackupService, validateBackup } = require('./backupService.cjs');

let storageReady = false;
let assetService;
let inventoryService;
let maintenanceService;
let financeService;
let supplierService;
let backupService;
let dataDirectoryPath;
const relatedDataQueue = createOperationQueue();

function isTrustedUrl(value) {
  try {
    const url = new URL(value);
    if (process.argv.includes('--dev')) return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '5173';
    return url.protocol === 'file:' && fileURLToPath(url).split('#')[0] === path.resolve(__dirname, '../dist/index.html');
  } catch { return false; }
}

function isTrustedRenderer(event) {
  return Boolean(event.senderFrame && event.senderFrame === event.sender.mainFrame && isTrustedUrl(event.senderFrame.url));
}

function registerIpcHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedRenderer(event)) return { ok: false, error: 'This request is not from the SmartWater application window.' };
    return handler(event, ...args);
  });
}

async function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  try { await fs.rename(temporaryPath, filePath); }
  catch (error) { await fs.rm(temporaryPath, { force: true }).catch(() => {}); throw error; }
}

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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!isTrustedUrl(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());

  if (process.argv.includes('--dev')) {
    window.loadURL('http://127.0.0.1:5173');
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

registerIpcHandler('app:health-check', async () => ({
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
    registerIpcHandler(channel, async (_event, ...args) => {
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
    registerIpcHandler(channel, async (_event, ...args) => {
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
    registerIpcHandler(channel, async (_event, ...args) => {
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
    registerIpcHandler(channel, async (_event, ...args) => {
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

function registerSupplierHandlers() {
  const handlers = {
    'suppliers:list': () => supplierService.listSuppliers(),
    'suppliers:get': (id) => supplierService.getSupplier(id),
    'suppliers:create': (supplier) => supplierService.createSupplier(supplier),
    'suppliers:update': (id, supplier) => supplierService.updateSupplier(id, supplier),
    'suppliers:delete': (id) => supplierService.deleteSupplier(id),
  };
  for (const [channel, operation] of Object.entries(handlers)) {
    registerIpcHandler(channel, async (_event, ...args) => {
      try {
        if (!storageReady || !supplierService) throw new Error('Storage is not ready.');
        return { ok: true, data: await operation(...args) };
      } catch (error) {
        if (!(error instanceof SupplierServiceError)) console.error(`SmartWater supplier operation failed (${channel}):`, error);
        const message = error instanceof SupplierServiceError ? error.message : error instanceof SyntaxError ? 'A supplier data file is malformed. No changes were saved.' : 'SmartWater could not read or save suppliers. Please try again.';
        return { ok: false, error: message };
      }
    });
  }
}

function registerReportHandlers() {
  registerIpcHandler('reports:data', async (_event, type, filters) => {
    try {
      if (!storageReady || !dataDirectoryPath) throw new Error('Storage is not ready.');
      return { ok: true, data: await getReportData(dataDirectoryPath, type, filters) };
    } catch (error) {
      if (!(error instanceof ReportsServiceError)) console.error('SmartWater report data failed:', error);
      const message = error instanceof ReportsServiceError ? error.message : error instanceof SyntaxError ? 'A report data file is malformed.' : 'SmartWater could not prepare this report.';
      return { ok: false, error: message };
    }
  });
  registerIpcHandler('reports:export-pdf', async (_event, type, filters) => {
    let printWindow;
    let temporaryDirectory;
    try {
      if (!storageReady || !dataDirectoryPath) throw new Error('Storage is not ready.');
      const report = await getReportData(dataDirectoryPath, type, filters);
      const safeTitle = report.title.replace(/[^A-Za-z0-9 -]/g, '').trim().replaceAll(' ', '-') || 'SmartWater-Report';
      const saveResult = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
        title: `Export ${report.title} as PDF`,
        defaultPath: path.join(app.getPath('documents'), `${safeTitle}-${report.generatedAt.slice(0, 10)}.pdf`),
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return { ok: true, cancelled: true };

      temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartwater-report-'));
      const htmlPath = path.join(temporaryDirectory, 'report.html');
      await fs.writeFile(htmlPath, buildPdfHtml(report), 'utf8');
      printWindow = new BrowserWindow({ show: false, width: 1100, height: 800, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
      await printWindow.loadFile(htmlPath);
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape: true, marginsType: 0 });
      await fs.writeFile(saveResult.filePath, pdf);
      return { ok: true, data: { fileName: path.basename(saveResult.filePath) } };
    } catch (error) {
      if (!(error instanceof ReportsServiceError)) console.error('SmartWater PDF export failed:', error);
      const message = error instanceof ReportsServiceError ? error.message : error instanceof SyntaxError ? 'A report data file is malformed.' : 'SmartWater could not create the PDF. Choose another location and try again.';
      return { ok: false, error: message };
    } finally {
      if (printWindow && !printWindow.isDestroyed()) printWindow.close();
      if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
    }
  });
}

function registerBackupHandlers() {
  registerIpcHandler('backup:export', async () => {
    try {
      if (!storageReady || !backupService) throw new Error('Storage is not ready.');
      const backup = await backupService.createBackup();
      const saveResult = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
        title: 'Export SmartWater backup', defaultPath: path.join(app.getPath('documents'), `SmartWater-Backup-${backup.createdAt.slice(0, 10)}.json`),
        filters: [{ name: 'SmartWater backup', extensions: ['json'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return { ok: true, cancelled: true };
      const filePath = path.extname(saveResult.filePath).toLowerCase() === '.json' ? saveResult.filePath : `${saveResult.filePath}.json`;
      await writeJsonAtomically(filePath, backup);
      return { ok: true, data: { fileName: path.basename(filePath), createdAt: backup.createdAt } };
    } catch (error) {
      if (!(error instanceof BackupServiceError)) console.error('SmartWater backup export failed:', error);
      return { ok: false, error: error instanceof BackupServiceError ? error.message : 'SmartWater could not export a backup. Please try again.' };
    }
  });
  registerIpcHandler('backup:restore', async () => {
    try {
      if (!storageReady || !backupService) throw new Error('Storage is not ready.');
      const selection = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
        title: 'Choose SmartWater backup', properties: ['openFile'], filters: [{ name: 'SmartWater backup', extensions: ['json'] }],
      });
      if (selection.canceled || !selection.filePaths[0]) return { ok: true, cancelled: true };
      const filePath = selection.filePaths[0];
      const stats = await fs.stat(filePath);
      if (stats.size > 100 * 1024 * 1024) throw new BackupServiceError('This backup file is larger than the supported 100 MB limit.');
      const payload = validateBackup(JSON.parse(await fs.readFile(filePath, 'utf8')));
      const confirmation = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() ?? undefined, {
        type: 'warning', title: 'Replace SmartWater data?',
        message: 'Restoring this backup will replace all current SmartWater records on this device.',
        detail: 'A safety backup of the current records will be created before restoration. This cannot be undone from the application.',
        buttons: ['Restore data', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
      });
      if (confirmation.response !== 0) return { ok: true, cancelled: true };
      const safetyBackup = await backupService.createBackup();
      const backupDirectory = path.join(app.getPath('userData'), 'backups');
      await fs.mkdir(backupDirectory, { recursive: true });
      const safetyFileName = `SmartWater-Pre-Restore-${safetyBackup.createdAt.replaceAll(':', '-').replaceAll('.', '-')}-${randomUUID().slice(0, 8)}.json`;
      await writeJsonAtomically(path.join(backupDirectory, safetyFileName), safetyBackup);
      await backupService.restoreBackup(payload);
      return { ok: true, data: { restoredAt: payload.createdAt, safetyBackupFile: safetyFileName } };
    } catch (error) {
      if (!(error instanceof BackupServiceError) && !(error instanceof SyntaxError)) console.error('SmartWater backup restore failed:', error);
      const message = error instanceof BackupServiceError ? error.message : error instanceof SyntaxError ? 'This file does not contain valid backup JSON.' : 'SmartWater could not restore this backup. Current records were kept or rolled back where possible.';
      return { ok: false, error: message };
    }
  });
}

app.whenReady().then(async () => {
  try {
    const dataDirectory = path.join(app.getPath('userData'), 'data');
    dataDirectoryPath = dataDirectory;
    await ensureStorage(dataDirectory);
    assetService = createAssetService(dataDirectory, relatedDataQueue);
    inventoryService = createInventoryService(dataDirectory, relatedDataQueue);
    maintenanceService = createMaintenanceService(dataDirectory, relatedDataQueue);
    financeService = createFinanceService(dataDirectory, relatedDataQueue);
    supplierService = createSupplierService(dataDirectory, relatedDataQueue);
    backupService = createBackupService(dataDirectory, relatedDataQueue);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    registerAssetHandlers();
    registerInventoryHandlers();
    registerMaintenanceHandlers();
    registerFinanceHandlers();
    registerSupplierHandlers();
    registerReportHandlers();
    registerBackupHandlers();
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
