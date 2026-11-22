const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { ensureStorage, readCollection } = require('../electron/storage.cjs');
const { createBackupService, validateBackup, FORMAT, VERSION, COLLECTIONS } = require('../electron/backupService.cjs');
const { createOperationQueue } = require('../electron/operationQueue.cjs');
const { createAssetService } = require('../electron/assetsService.cjs');
const { createInventoryService } = require('../electron/inventoryService.cjs');
const { createMaintenanceService, localToday } = require('../electron/maintenanceService.cjs');
const { createFinanceService } = require('../electron/financeService.cjs');
const { createSupplierService } = require('../electron/supplierService.cjs');

let directory; let backups; let assets; let inventory; let maintenance; let finance; let suppliers;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartwater-backup-')); await ensureStorage(directory);
  const queue = createOperationQueue(); backups = createBackupService(directory, queue); assets = createAssetService(directory, queue);
  inventory = createInventoryService(directory, queue); maintenance = createMaintenanceService(directory, queue);
  finance = createFinanceService(directory, queue); suppliers = createSupplierService(directory, queue);
});
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));
test('exports a versioned backup containing every stored collection', async () => {
  await assets.createAsset({ assetCode: 'PUMP-1', name: 'Pump', category: 'Pump' });
  const backup = await backups.createBackup('2026-11-22T10:00:00.000Z');
  assert.equal(backup.format, FORMAT); assert.equal(backup.version, VERSION); assert.equal(backup.createdAt, '2026-11-22T10:00:00.000Z');
  assert.deepEqual(Object.keys(backup.collections).sort(), [...COLLECTIONS].sort()); assert.equal(backup.collections.assets.length, 1);
});
test('restores all collections after validating internal references', async () => {
  const asset = await assets.createAsset({ assetCode: 'PUMP-1', name: 'Pump', category: 'Pump' });
  const supplier = await suppliers.createSupplier({ name: 'Aqua Supply', suppliedCategories: ['Chemicals'] });
  const item = await inventory.createItem({ itemCode: 'CHL-1', name: 'Chlorine', category: 'Chemicals', unit: 'kg', currentStock: 2, minimumStock: 1, supplierId: supplier.id });
  await inventory.stockIn({ itemId: item.id, quantity: 1, date: localToday() });
  const order = await maintenance.createRecord({ assetId: asset.id, maintenanceType: 'Preventive', title: 'Inspect pump', description: '', priority: 'Medium', scheduledDate: localToday(), assignedTo: '', remarks: '' });
  await finance.createTransaction({ type: 'Expense', title: 'Pump repair', category: 'Equipment Repair', amount: '12.50', date: localToday(), paymentMethod: 'Cash', referenceNumber: '', description: '', relatedWorkOrderId: order.id, partyName: '', notes: '' });
  const today = localToday(); const [year, month] = today.split('-').map(Number);
  await finance.createBudget({ category: 'Electricity', month, year, budgetAmount: '100.00' });
  const payload = await backups.createBackup();
  await assets.createAsset({ assetCode: 'OTHER-1', name: 'Other asset', category: 'Valve' });
  const result = await backups.restoreBackup(payload);
  assert.equal(result.collectionCount, 7); assert.equal((await readCollection(directory, 'assets')).length, 1);
  assert.equal((await readCollection(directory, 'inventoryTransactions')).length, 1); assert.equal((await readCollection(directory, 'finances')).length, 1);
  assert.equal((await readCollection(directory, 'budgets')).length, 1); assert.equal((await readCollection(directory, 'suppliers')).length, 1);
});
test('rejects incomplete, duplicate, unsupported and broken-reference backups without changing data', async () => {
  await assets.createAsset({ assetCode: 'KEEP-1', name: 'Keep this', category: 'Pump' });
  const valid = await backups.createBackup();
  const incomplete = structuredClone(valid); delete incomplete.collections.suppliers;
  const unsupported = { ...structuredClone(valid), version: 2 };
  const duplicate = structuredClone(valid); duplicate.collections.assets.push({ ...duplicate.collections.assets[0], id: '00000000-0000-4000-8000-000000000001' });
  const brokenReference = structuredClone(valid); brokenReference.collections.inventory.push({ id: '00000000-0000-4000-8000-000000000002', itemCode: 'CHL-1', name: 'Chlorine', category: 'Chemicals', unit: 'kg', currentStock: 1, minimumStock: 1, location: '', supplier: '', description: '', supplierId: '00000000-0000-4000-8000-000000000099', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  for (const payload of [incomplete, unsupported, duplicate, brokenReference]) {
    assert.throws(() => validateBackup(payload)); await assert.rejects(backups.restoreBackup(payload));
    assert.equal((await readCollection(directory, 'assets'))[0].assetCode, 'KEEP-1');
  }
});
test('backup snapshot includes empty collections and leaves existing data untouched', async () => {
  await suppliers.createSupplier({ name: 'Aqua Supply', suppliedCategories: [] });
  const before = await readCollection(directory, 'suppliers'); const backup = await backups.createBackup();
  assert.deepEqual(backup.collections.budgets, []); assert.deepEqual(await readCollection(directory, 'suppliers'), before);
});
