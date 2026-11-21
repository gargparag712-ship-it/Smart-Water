const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const { test } = require('node:test');

const sourcePath = path.join(__dirname, '../src/utils/filterAssets.js');
const compiled = transformSync(fs.readFileSync(sourcePath, 'utf8'), { loader: 'js', format: 'cjs' });
const filterModule = { exports: {} };
new Function('module', 'exports', compiled.code)(filterModule, filterModule.exports);
const { filterAssets, filtersAreActive } = filterModule.exports;

const assets = [
  { name: 'Borewell Pump', assetCode: 'PMP-001', serialNumber: 'SER-1001', location: 'North pump house', category: 'Pump', condition: 'Good', status: 'Active' },
  { name: 'East Pipeline', assetCode: 'PIP-002', serialNumber: 'SER-2002', location: 'East road', category: 'Pipeline', condition: 'Fair', status: 'Under Maintenance' },
  { name: 'Storage Tank', assetCode: 'TNK-003', serialNumber: 'SER-3003', location: 'North ridge', category: 'Tank', condition: 'Excellent', status: 'Active' },
];

test('searches by asset name, code, serial number and location', () => {
  for (const search of ['borewell', 'pip-002', 'ser-3003', 'east road']) {
    assert.equal(filterAssets(assets, { search, category: '', condition: '', status: '' }).length, 1);
  }
});

test('combines search and category, condition and status filters', () => {
  const filtered = filterAssets(assets, { search: 'east', category: 'Pipeline', condition: 'Fair', status: 'Under Maintenance' });
  assert.deepEqual(filtered.map((asset) => asset.assetCode), ['PIP-002']);
  assert.deepEqual(filterAssets(assets, { search: '', category: 'Pump', condition: 'Poor', status: 'Active' }), []);
});

test('detects active filters and supports the clear-filters state', () => {
  assert.equal(filtersAreActive({ search: '', category: '', condition: '', status: '' }), false);
  assert.equal(filtersAreActive({ search: '', category: 'Tank', condition: '', status: '' }), true);
});
