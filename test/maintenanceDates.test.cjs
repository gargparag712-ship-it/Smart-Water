const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/maintenanceDates.js'), 'utf8');
const compiled = transformSync(source, { format: 'cjs', loader: 'js' }); const mod = { exports: {} }; new Function('module', 'exports', compiled.code)(mod, mod.exports);
const { buildMaintenanceAlerts, filterMaintenance, maintenanceDateStatus, summarizeMaintenance } = mod.exports;
const rows = [
  { id: 'a', workOrderCode: 'WO-A', assetId: '1', assetCode: 'PMP-1', assetName: 'Pump', title: 'Inspect pump', maintenanceType: 'Preventive', priority: 'High', scheduledDate: '2026-11-21', status: 'Scheduled', assignedTo: 'Mina' },
  { id: 'b', workOrderCode: 'WO-B', assetId: '2', assetCode: 'VAL-1', assetName: 'Valve', title: 'Repair valve', maintenanceType: 'Corrective', priority: 'Critical', scheduledDate: '2026-11-22', status: 'In Progress', assignedTo: 'Raj' },
  { id: 'c', workOrderCode: 'WO-C', assetId: '1', assetCode: 'PMP-1', assetName: 'Pump', title: 'Change seal', maintenanceType: 'Preventive', priority: 'Low', scheduledDate: '2026-11-26', status: 'Scheduled', assignedTo: 'Mina' },
  { id: 'd', workOrderCode: 'WO-D', assetId: '2', assetCode: 'VAL-1', assetName: 'Valve', title: 'Old work', maintenanceType: 'Corrective', priority: 'Low', scheduledDate: '2026-11-20', status: 'Completed', assignedTo: '' },
];
test('date alert calculation marks overdue, due today and upcoming and excludes finished work', () => {
  const today = '2026-11-22'; assert.equal(maintenanceDateStatus(rows[0], today), 'overdue'); assert.equal(maintenanceDateStatus(rows[1], today), 'dueToday'); assert.equal(maintenanceDateStatus(rows[2], today), 'upcoming'); assert.equal(maintenanceDateStatus(rows[3], today), '');
  assert.deepEqual(summarizeMaintenance(rows, today), { total: 4, scheduled: 2, inProgress: 1, completed: 1, overdue: 1, dueToday: 1, upcoming: 1, pending: 3, attention: 2 });
  assert.equal(buildMaintenanceAlerts(rows, today).length, 3);
});
test('search and type, status, priority and date filters combine', () => {
  const filtered = filterMaintenance(rows, { search: 'pump', maintenanceType: 'Preventive', status: 'Scheduled', priority: 'Low', fromDate: '2026-11-25', toDate: '2026-11-27' }); assert.deepEqual(filtered.map((row) => row.id), ['c']);
});
