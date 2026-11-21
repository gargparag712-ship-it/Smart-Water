const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { createAssetService } = require('../electron/assetsService.cjs');
const { ensureStorage, readCollection } = require('../electron/storage.cjs');

let dataDirectory;
let service;

const validAsset = {
  assetCode: 'pmp-0001',
  name: 'Borewell Pump',
  category: 'Pump',
  scheme: 'Kalyanpur Water Scheme',
  location: 'Pump house 1',
  manufacturer: 'WaterWorks',
  modelNumber: 'WW-40',
  serialNumber: 'SER-8082',
  purchaseDate: '2023-04-10',
  installationDate: '2023-04-14',
  condition: 'Good',
  status: 'Active',
  description: 'Primary borewell pump.',
};

beforeEach(async () => {
  dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartwater-assets-'));
  await ensureStorage(dataDirectory);
  service = createAssetService(dataDirectory);
});

afterEach(async () => {
  await fs.rm(dataDirectory, { recursive: true, force: true });
});

test('creates, lists, reads, updates and deletes an asset', async () => {
  const created = await service.createAsset(validAsset);
  assert.match(created.id, /^[0-9a-f-]{36}$/i);
  assert.equal(created.assetCode, 'PMP-0001');
  assert.equal(created.condition, 'Good');
  assert.equal(created.status, 'Active');
  assert.equal(created.modelNumber, 'WW-40');
  assert.deepEqual(await service.listAssets(), [created]);
  assert.deepEqual(await service.getAsset(created.id), created);

  const updated = await service.updateAsset(created.id, { ...validAsset, name: 'Borewell Pump A' });
  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.ok(Date.parse(updated.updatedAt) > Date.parse(created.updatedAt));
  assert.equal(updated.name, 'Borewell Pump A');

  const removed = await service.deleteAsset(created.id);
  assert.deepEqual(removed, { id: created.id, assetCode: 'PMP-0001', name: 'Borewell Pump A' });
  assert.deepEqual(await service.listAssets(), []);
});

test('rejects duplicate asset codes without regard to case', async () => {
  await service.createAsset(validAsset);
  await assert.rejects(service.createAsset({ ...validAsset, assetCode: 'pMp-0001' }), /already in use/);
});

test('rejects an edit that takes another asset code and keeps both records unchanged', async () => {
  const first = await service.createAsset(validAsset);
  const second = await service.createAsset({ ...validAsset, assetCode: 'VAL-0002', name: 'Gate Valve' });
  await assert.rejects(service.updateAsset(first.id, { ...validAsset, assetCode: second.assetCode }), /already in use/);
  assert.equal((await service.getAsset(first.id)).assetCode, first.assetCode);
  assert.equal((await service.getAsset(second.id)).name, second.name);
});

test('applies safe defaults to optional asset fields', async () => {
  const asset = await service.createAsset({ assetCode: 'TNK-001', name: 'Clear Water Tank', category: 'Tank' });
  assert.equal(asset.scheme, '');
  assert.equal(asset.location, '');
  assert.equal(asset.condition, 'Good');
  assert.equal(asset.status, 'Active');
  assert.equal(asset.purchaseDate, '');
  assert.equal(asset.installationDate, '');
  assert.equal(asset.description, '');
});

test('preserves readable line breaks in asset descriptions', async () => {
  const asset = await service.createAsset({ ...validAsset, description: 'Main pump.\nServiced in April.' });
  assert.equal(asset.description, 'Main pump.\nServiced in April.');
});

test('rejects missing required name, category and asset code', async () => {
  await assert.rejects(service.createAsset({ ...validAsset, name: '  ' }), /Asset name is required/);
  await assert.rejects(service.createAsset({ ...validAsset, category: '' }), /valid asset category/);
  await assert.rejects(service.createAsset({ ...validAsset, assetCode: '' }), /Asset code is required/);
});

test('rejects invalid dates and installation before purchase', async () => {
  await assert.rejects(service.createAsset({ ...validAsset, purchaseDate: '2024-02-30' }), /valid date/);
  await assert.rejects(service.createAsset({ ...validAsset, purchaseDate: '2024-03-12', installationDate: '2024-03-11' }), /cannot be before/);
});

test('does not accept renderer-provided internal IDs or timestamps', async () => {
  await assert.rejects(service.createAsset({ ...validAsset, id: '00000000-0000-0000-0000-000000000000' }), /assigned by SmartWater/);
  await assert.rejects(service.updateAsset('00000000-0000-0000-0000-000000000000', validAsset), /Asset not found/);
});

test('serializes competing writes so duplicate codes cannot race', async () => {
  const results = await Promise.allSettled([
    service.createAsset(validAsset),
    service.createAsset({ ...validAsset, name: 'Duplicate Pump' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal((await service.listAssets()).length, 1);
});

test('preserves other collections and reads assets after service recreation', async () => {
  const created = await service.createAsset(validAsset);
  service = createAssetService(dataDirectory);
  assert.deepEqual(await service.getAsset(created.id), created);
  for (const collection of ['inventory', 'maintenance', 'finances', 'suppliers']) {
    assert.deepEqual(await readCollection(dataDirectory, collection), []);
  }
});

test('does not overwrite malformed asset JSON', async () => {
  const filePath = path.join(dataDirectory, 'assets.json');
  await fs.writeFile(filePath, '{ malformed json', 'utf8');
  await assert.rejects(service.listAssets(), SyntaxError);
  assert.equal(await fs.readFile(filePath, 'utf8'), '{ malformed json');
});
