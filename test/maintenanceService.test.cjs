const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { createAssetService } = require('../electron/assetsService.cjs');
const { createMaintenanceService, localToday } = require('../electron/maintenanceService.cjs');
const { createOperationQueue } = require('../electron/operationQueue.cjs');
const { ensureStorage } = require('../electron/storage.cjs');

let directory; let assets; let service; let asset;
const assetInput = { assetCode: 'PMP-44', name: 'Borewell Pump', category: 'Pump', status: 'Active' };
const orderInput = (assetId, extra = {}) => ({ assetId, maintenanceType: 'Preventive', title: 'Quarterly pump inspection', description: 'Inspect and test', priority: 'High', scheduledDate: localToday(), assignedTo: 'Mohan Kumar', remarks: 'Coordinate downtime', ...extra });
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartwater-maintenance-')); await ensureStorage(directory);
  const queue = createOperationQueue(); assets = createAssetService(directory, queue); service = createMaintenanceService(directory, queue); asset = await assets.createAsset(assetInput);
});
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));

test('creates a scheduled work order with unique Main-generated code and asset snapshot', async () => {
  const record = await service.createRecord(orderInput(asset.id));
  assert.match(record.id, /^[0-9a-f-]{36}$/i); assert.match(record.workOrderCode, /^WO-\d{8}-\d{4}$/); assert.equal(record.status, 'Scheduled');
  assert.equal(record.assetCode, 'PMP-44'); assert.equal(record.assetName, 'Borewell Pump'); assert.equal(record.totalCost, 0);
  const second = await service.createRecord(orderInput(asset.id, { title: 'Seal inspection' })); assert.notEqual(second.workOrderCode, record.workOrderCode);
});
test('rejects a missing asset reference, invalid asset, missing required fields and duplicate code input', async () => {
  await assert.rejects(service.createRecord(orderInput('00000000-0000-0000-0000-000000000000')), /does not exist/);
  await assert.rejects(service.createRecord(orderInput(asset.id, { title: ' ' })), /title is required/);
  await assert.rejects(service.createRecord({ ...orderInput(asset.id), workOrderCode: 'WO-MANUAL' }), /Unsupported maintenance field/);
  await assert.rejects(service.createRecord(orderInput(asset.id, { scheduledDate: '2026-02-30' })), /valid scheduled date/);
});
test('allows Scheduled to In Progress and rejects invalid status transitions', async () => {
  const record = await service.createRecord(orderInput(asset.id));
  const started = await service.updateStatus(record.id, { status: 'In Progress' }); assert.equal(started.status, 'In Progress');
  await assert.rejects(service.updateStatus(record.id, { status: 'Scheduled' }), /Cannot change/);
  await assert.rejects(service.updateStatus(record.id, { status: 'Cancelled' }), /Cannot change/);
  await assert.rejects(service.updateStatus(record.id, { status: 'Completed', completionDate: localToday(), workPerformed: 'Done', labourCost: -1, partsCost: 0 }), /Labour cost/);
  assert.equal((await service.getRecord(record.id)).status, 'In Progress');
});
test('captures completion details and calculates the total cost', async () => {
  const record = await service.createRecord(orderInput(asset.id)); await service.updateStatus(record.id, { status: 'In Progress' });
  const completed = await service.updateStatus(record.id, { status: 'Completed', completionDate: localToday(), workPerformed: 'Replaced bearing and tested pump.', labourCost: 1250, partsCost: 875.5 });
  assert.equal(completed.status, 'Completed'); assert.equal(completed.totalCost, 2125.5); assert.equal(completed.workPerformed, 'Replaced bearing and tested pump.');
  await assert.rejects(service.updateStatus(record.id, { status: 'Scheduled' }), /Cannot change/);
  await assert.rejects(service.updateRecord(record.id, orderInput(asset.id)), /preserved/);
  await assert.rejects(service.updateStatus(record.id, { status: 'Completed', completionDate: localToday(), workPerformed: 'No extras', labourCost: 1, partsCost: 2, totalCost: 3 }), /Cannot change a completed/);
});
test('allows cancelling scheduled work and preserves the record', async () => {
  const record = await service.createRecord(orderInput(asset.id)); const cancelled = await service.updateStatus(record.id, { status: 'Cancelled' });
  assert.equal(cancelled.status, 'Cancelled'); assert.equal((await service.listRecords()).length, 1);
});
test('calculates overdue, due today and upcoming while excluding completed and cancelled', async () => {
  const today = '2026-11-22';
  const { summarizeMaintenance } = require('../electron/maintenanceDates.cjs');
  const records = [
    { status: 'Scheduled', scheduledDate: '2026-11-21' }, { status: 'In Progress', scheduledDate: today },
    { status: 'Scheduled', scheduledDate: '2026-11-25' }, { status: 'Scheduled', scheduledDate: '2026-12-10' },
    { status: 'Completed', scheduledDate: '2026-11-20' }, { status: 'Cancelled', scheduledDate: '2026-11-20' },
  ];
  assert.deepEqual(summarizeMaintenance(records, today), { total: 6, scheduled: 3, inProgress: 1, completed: 1, overdue: 1, dueToday: 1, upcoming: 1, pending: 4, attention: 2 });
});
test('filters maintenance alerts by work order and date and returns asset-linked history', async () => {
  const record = await service.createRecord(orderInput(asset.id));
  const list = await service.listRecords({ search: 'pmp-44', priority: 'High', fromDate: localToday(), toDate: localToday() }); assert.equal(list.length, 1);
  assert.deepEqual(await service.listAssetHistory(asset.id), [record]);
});
test('preserves work order data after service recreation and protects its asset from deletion', async () => {
  const record = await service.createRecord(orderInput(asset.id)); service = createMaintenanceService(directory, createOperationQueue());
  assert.deepEqual(await service.getRecord(record.id), record);
  await assert.rejects(assets.deleteAsset(asset.id), /maintenance history/);
});
