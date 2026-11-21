const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { createInventoryService } = require('../electron/inventoryService.cjs');
const { ensureStorage } = require('../electron/storage.cjs');

let directory; let service;
const validItem = { itemCode: 'chl-001', name: 'Chlorine tablets', category: 'Chemicals', unit: 'packet', currentStock: 20, minimumStock: 5, location: 'Main store', supplier: 'Aqua Supply', description: 'Water treatment stock' };
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartwater-inventory-')); await ensureStorage(directory); service = createInventoryService(directory); });
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));

test('creates, reads, updates and deletes inventory items', async () => {
  const item = await service.createItem(validItem); assert.equal(item.itemCode, 'CHL-001'); assert.equal((await service.getItem(item.id)).name, item.name);
  const updated = await service.updateItem(item.id, { ...validItem, currentStock: 20, name: 'Chlorine tablets 1kg' }); assert.equal(updated.name, 'Chlorine tablets 1kg');
  assert.deepEqual(await service.deleteItem(item.id), { id: item.id, itemCode: 'CHL-001', name: 'Chlorine tablets 1kg' }); assert.deepEqual(await service.listItems(), []);
});
test('rejects duplicate codes, missing required fields and invalid quantities', async () => {
  await service.createItem(validItem); await assert.rejects(service.createItem({ ...validItem, itemCode: 'Chl-001' }), /already in use/);
  await assert.rejects(service.createItem({ ...validItem, name: ' ' }), /Item name is required/);
  await assert.rejects(service.createItem({ ...validItem, currentStock: -1 }), /valid zero or positive quantity/);
  await assert.rejects(service.createItem({ ...validItem, minimumStock: Infinity }), /valid zero or positive quantity/);
});
test('rejects direct stock edits so all quantity changes have a movement record', async () => {
  const item = await service.createItem(validItem);
  await assert.rejects(service.updateItem(item.id, { ...validItem, currentStock: 21 }), /Stock In or Stock Out/);
  assert.equal((await service.getItem(item.id)).currentStock, 20);
});
test('Stock In adjusts quantity and creates an auditable transaction', async () => {
  const item = await service.createItem(validItem);
  const result = await service.stockIn({ itemId: item.id, quantity: 4.5, date: '2026-11-21', referenceNumber: 'GRN-19', partyOrSupplier: 'Aqua Supply', notes: 'Delivery received' });
  assert.equal(result.item.currentStock, 24.5); assert.equal(result.transaction.transactionType, 'IN'); assert.equal(result.transaction.previousStock, 20); assert.equal(result.transaction.newStock, 24.5);
  assert.deepEqual(await service.listTransactions(), [result.transaction]);
});
test('Stock Out adjusts quantity and rejects zero, invalid and insufficient amounts without changes', async () => {
  const item = await service.createItem(validItem);
  await assert.rejects(service.stockOut({ itemId: item.id, quantity: 0, date: '2026-11-21' }), /positive quantity/);
  await assert.rejects(service.stockOut({ itemId: item.id, quantity: 21, date: '2026-11-21' }), /cannot exceed available stock/);
  assert.equal((await service.getItem(item.id)).currentStock, 20); assert.deepEqual(await service.listTransactions(), []);
  const result = await service.stockOut({ itemId: item.id, quantity: 7, date: '2026-11-21', partyOrSupplier: 'Pump house' });
  assert.equal(result.item.currentStock, 13); assert.equal(result.transaction.transactionType, 'OUT');
});
test('serializes simultaneous movements and prevents negative stock', async () => {
  const item = await service.createItem({ ...validItem, currentStock: 10 });
  const results = await Promise.allSettled([service.stockOut({ itemId: item.id, quantity: 7, date: '2026-11-21' }), service.stockOut({ itemId: item.id, quantity: 7, date: '2026-11-21' })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1); assert.equal((await service.getItem(item.id)).currentStock, 3); assert.equal((await service.listTransactions()).length, 1);
});
test('prevents deleting items with transaction history', async () => {
  const item = await service.createItem(validItem); await service.stockIn({ itemId: item.id, quantity: 1, date: '2026-11-21' });
  await assert.rejects(service.deleteItem(item.id), /transaction history/); assert.equal((await service.getItem(item.id)).id, item.id);
});
test('preserves items and transaction history after service restart', async () => {
  const item = await service.createItem(validItem); await service.stockIn({ itemId: item.id, quantity: 2, date: '2026-11-21' });
  service = createInventoryService(directory); const rows = await service.listTransactions();
  assert.equal((await service.getItem(item.id)).currentStock, 22); assert.equal(rows.length, 1);
});
test('filters transaction history by item, type and date range', async () => {
  const item = await service.createItem(validItem); await service.stockIn({ itemId: item.id, quantity: 2, date: '2026-11-20' }); await service.stockOut({ itemId: item.id, quantity: 1, date: '2026-11-21' });
  const out = await service.listTransactions({ itemId: item.id, transactionType: 'OUT', fromDate: '2026-11-21', toDate: '2026-11-21' }); assert.equal(out.length, 1); assert.equal(out[0].transactionType, 'OUT');
});
