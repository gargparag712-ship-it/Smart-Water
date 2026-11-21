const assert = require('node:assert/strict');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const source = require('node:fs').readFileSync(require.resolve('../src/utils/filterInventory.js'), 'utf8');
const compiled = transformSync(source, { format: 'cjs', loader: 'js' });
const filterModule = { exports: {} };
new Function('module', 'exports', compiled.code)(filterModule, filterModule.exports);
const { filterInventory, getInventoryCounts, isLowStock } = filterModule.exports;
const items = [
  { id: '1', itemCode: 'CHL-001', name: 'Chlorine tablets', category: 'Chemicals', location: 'Main store', currentStock: 2, minimumStock: 5 },
  { id: '2', itemCode: 'GSK-001', name: 'Pump gasket', category: 'Spare Parts', location: 'Workshop', currentStock: 0, minimumStock: 0 },
  { id: '3', itemCode: 'CAB-001', name: 'Copper cable', category: 'Electrical Supplies', location: 'Main store', currentStock: 20, minimumStock: 5 },
];
test('low and out-of-stock counts follow minimum stock thresholds', () => { assert.equal(isLowStock(items[0]), true); assert.deepEqual(getInventoryCounts(items), { total: 3, low: 2, out: 1 }); });
test('search matches item name, code and storage location', () => { assert.equal(filterInventory(items, { search: 'chlorine' }).length, 1); assert.equal(filterInventory(items, { search: 'gsk-001' }).length, 1); assert.equal(filterInventory(items, { search: 'workshop' }).length, 1); });
test('category and stock status filters combine', () => { assert.deepEqual(filterInventory(items, { category: 'Chemicals', stockStatus: 'low' }).map((item) => item.id), ['1']); assert.deepEqual(filterInventory(items, { stockStatus: 'out' }).map((item) => item.id), ['2']); assert.deepEqual(filterInventory(items, { stockStatus: 'in' }).map((item) => item.id), ['3']); });
