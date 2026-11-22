const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

test('preload exposes only scoped application IPC functions', async () => {
  const preloadPath = require.resolve('../electron/preload.cjs');
  const originalLoad = Module._load;
  const calls = [];
  let exposedName;
  let exposedApi;
  const fakeElectron = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        exposedName = name;
        exposedApi = api;
      },
    },
    ipcRenderer: {
      invoke: (...args) => {
        calls.push(args);
        return Promise.resolve({ ok: true });
      },
    },
  };

  delete require.cache[preloadPath];
  Module._load = function loadWithElectronMock(request, parent, isMain) {
    return request === 'electron' ? fakeElectron : originalLoad.call(this, request, parent, isMain);
  };
  try {
    require(preloadPath);
  } finally {
    Module._load = originalLoad;
  }

  assert.equal(exposedName, 'smartWater');
  assert.deepEqual(Object.keys(exposedApi).sort(), [
    'checkHealth', 'createAsset', 'createBudget', 'createFinancialTransaction', 'createInventoryItem', 'createMaintenanceRecord', 'createSupplier',
    'deleteAsset', 'deleteBudget', 'deleteFinancialTransaction', 'deleteInventoryItem', 'deleteSupplier', 'exportReportPdf',
    'getAsset', 'getFinanceSummary', 'getFinancialTransaction', 'getInventoryItem', 'getMaintenanceRecord', 'getMaintenanceSummary', 'getReportData', 'getSupplier', 'listAssetMaintenanceHistory',
    'listAssets', 'listBudgets', 'listFinanceMaintenanceOrders', 'listFinancialTransactions', 'listInventoryItems', 'listInventoryTransactions',
    'listMaintenanceAssets', 'listMaintenanceRecords', 'listSuppliers', 'stockIn', 'stockOut', 'updateAsset', 'updateBudget',
    'updateFinancialTransaction', 'updateInventoryItem', 'updateMaintenanceRecord', 'updateMaintenanceStatus', 'updateSupplier',
  ]);
  await exposedApi.checkHealth();
  await exposedApi.listAssets();
  await exposedApi.getAsset('asset-id');
  await exposedApi.createAsset({ name: 'Pump' });
  await exposedApi.updateAsset('asset-id', { name: 'Pump 2' });
  await exposedApi.deleteAsset('asset-id');
  await exposedApi.listInventoryItems();
  await exposedApi.getInventoryItem('item-id');
  await exposedApi.createInventoryItem({ name: 'Chlorine' });
  await exposedApi.updateInventoryItem('item-id', { name: 'Chlorine' });
  await exposedApi.deleteInventoryItem('item-id');
  await exposedApi.listInventoryTransactions({ transactionType: 'IN' });
  await exposedApi.stockIn({ itemId: 'item-id', quantity: 3 });
  await exposedApi.stockOut({ itemId: 'item-id', quantity: 1 });
  await exposedApi.listMaintenanceRecords({ status: 'Scheduled' });
  await exposedApi.getMaintenanceRecord('work-order-id');
  await exposedApi.createMaintenanceRecord({ assetId: 'asset-id' });
  await exposedApi.updateMaintenanceRecord('work-order-id', { title: 'Inspection' });
  await exposedApi.updateMaintenanceStatus('work-order-id', { status: 'In Progress' });
  await exposedApi.listAssetMaintenanceHistory('asset-id');
  await exposedApi.listMaintenanceAssets();
  await exposedApi.getMaintenanceSummary();
  await exposedApi.listFinancialTransactions({ type: 'Expense' });
  await exposedApi.getFinancialTransaction('finance-id');
  await exposedApi.createFinancialTransaction({ title: 'Expense' });
  await exposedApi.updateFinancialTransaction('finance-id', { title: 'Expense' });
  await exposedApi.deleteFinancialTransaction('finance-id');
  await exposedApi.getFinanceSummary();
  await exposedApi.listBudgets();
  await exposedApi.createBudget({ category: 'Electricity' });
  await exposedApi.updateBudget('budget-id', { category: 'Electricity' });
  await exposedApi.deleteBudget('budget-id');
  await exposedApi.listFinanceMaintenanceOrders();
  await exposedApi.listSuppliers();
  await exposedApi.getSupplier('supplier-id');
  await exposedApi.createSupplier({ name: 'Water Works' });
  await exposedApi.updateSupplier('supplier-id', { name: 'Water Works 2' });
  await exposedApi.deleteSupplier('supplier-id');
  await exposedApi.getReportData('finance', { fromDate: '2026-01-01' });
  await exposedApi.exportReportPdf('finance', {});
  assert.deepEqual(calls, [
    ['app:health-check'],
    ['assets:list'],
    ['assets:get', 'asset-id'],
    ['assets:create', { name: 'Pump' }],
    ['assets:update', 'asset-id', { name: 'Pump 2' }],
    ['assets:delete', 'asset-id'],
    ['inventory:list'],
    ['inventory:get', 'item-id'],
    ['inventory:create', { name: 'Chlorine' }],
    ['inventory:update', 'item-id', { name: 'Chlorine' }],
    ['inventory:delete', 'item-id'],
    ['inventory:transactions', { transactionType: 'IN' }],
    ['inventory:stock-in', { itemId: 'item-id', quantity: 3 }],
    ['inventory:stock-out', { itemId: 'item-id', quantity: 1 }],
    ['maintenance:list', { status: 'Scheduled' }],
    ['maintenance:get', 'work-order-id'],
    ['maintenance:create', { assetId: 'asset-id' }],
    ['maintenance:update', 'work-order-id', { title: 'Inspection' }],
    ['maintenance:update-status', 'work-order-id', { status: 'In Progress' }],
    ['maintenance:asset-history', 'asset-id'],
    ['maintenance:assets'],
    ['maintenance:summary'],
    ['finance:list', { type: 'Expense' }],
    ['finance:get', 'finance-id'],
    ['finance:create', { title: 'Expense' }],
    ['finance:update', 'finance-id', { title: 'Expense' }],
    ['finance:delete', 'finance-id'],
    ['finance:summary'],
    ['finance:budgets:list'],
    ['finance:budgets:create', { category: 'Electricity' }],
    ['finance:budgets:update', 'budget-id', { category: 'Electricity' }],
    ['finance:budgets:delete', 'budget-id'],
    ['finance:maintenance-orders'],
    ['suppliers:list'],
    ['suppliers:get', 'supplier-id'],
    ['suppliers:create', { name: 'Water Works' }],
    ['suppliers:update', 'supplier-id', { name: 'Water Works 2' }],
    ['suppliers:delete', 'supplier-id'],
    ['reports:data', 'finance', { fromDate: '2026-01-01' }],
    ['reports:export-pdf', 'finance', {}],
  ]);
});
