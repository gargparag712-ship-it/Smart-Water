const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

test('preload exposes only health plus scoped asset, inventory and maintenance IPC functions', async () => {
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
    'checkHealth', 'createAsset', 'createInventoryItem', 'createMaintenanceRecord', 'deleteAsset', 'deleteInventoryItem',
    'getAsset', 'getInventoryItem', 'getMaintenanceRecord', 'getMaintenanceSummary', 'listAssetMaintenanceHistory',
    'listAssets', 'listInventoryItems', 'listInventoryTransactions', 'listMaintenanceAssets', 'listMaintenanceRecords',
    'stockIn', 'stockOut', 'updateAsset', 'updateInventoryItem', 'updateMaintenanceRecord', 'updateMaintenanceStatus',
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
  ]);
});
