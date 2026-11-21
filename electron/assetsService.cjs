const { randomUUID } = require('node:crypto');
const { readCollection, writeCollection } = require('./storage.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');

const CATEGORIES = new Set([
  'Pump', 'Motor', 'Pipeline', 'Valve', 'Tank', 'Filter', 'Water Meter', 'Other',
]);
const CONDITIONS = new Set(['Excellent', 'Good', 'Fair', 'Poor']);
const STATUSES = new Set(['Active', 'Inactive', 'Under Maintenance', 'Decommissioned']);
const TEXT_LIMITS = Object.freeze({
  assetCode: 40,
  name: 120,
  scheme: 120,
  location: 160,
  manufacturer: 120,
  modelNumber: 100,
  serialNumber: 100,
  description: 2000,
});
const TEXT_FIELDS = Object.keys(TEXT_LIMITS);
const DATE_FIELDS = ['purchaseDate', 'installationDate'];
const ALLOWED_INPUT_FIELDS = new Set([
  ...TEXT_FIELDS,
  ...DATE_FIELDS,
  'category',
  'condition',
  'status',
]);

class AssetServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssetServiceError';
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(field, value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new AssetServiceError(`${field} must be text.`);
  const normalized = value.trim();
  if (normalized.length > TEXT_LIMITS[field]) {
    throw new AssetServiceError(`${field} must be ${TEXT_LIMITS[field]} characters or fewer.`);
  }
  const unsupportedCharacters = field === 'description'
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  if (unsupportedCharacters.test(normalized)) {
    throw new AssetServiceError(`${field} contains unsupported characters.`);
  }
  return field === 'assetCode' ? normalized.toUpperCase() : normalized;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeAssetInput(input) {
  if (!isRecord(input)) throw new AssetServiceError('Enter asset information before saving.');

  // Identity and timestamps are created by this process, never by the renderer.
  for (const field of ['id', 'createdAt', 'updatedAt']) {
    if (Object.hasOwn(input, field)) {
      throw new AssetServiceError(`${field} is assigned by SmartWater and cannot be changed here.`);
    }
  }
  for (const field of Object.keys(input)) {
    if (!ALLOWED_INPUT_FIELDS.has(field)) throw new AssetServiceError(`Unsupported asset field: ${field}.`);
  }

  const asset = {};
  for (const field of TEXT_FIELDS) asset[field] = normalizeText(field, input[field]);
  asset.category = input.category === undefined ? '' : input.category;
  asset.condition = input.condition || 'Good';
  asset.status = input.status || 'Active';

  for (const [field, value] of [['name', asset.name], ['asset code', asset.assetCode]]) {
    if (!value) throw new AssetServiceError(`${field === 'name' ? 'Asset name' : 'Asset code'} is required.`);
  }
  if (!CATEGORIES.has(asset.category)) throw new AssetServiceError('Choose a valid asset category.');
  if (!CONDITIONS.has(asset.condition)) throw new AssetServiceError('Choose a valid asset condition.');
  if (!STATUSES.has(asset.status)) throw new AssetServiceError('Choose a valid operational status.');
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(asset.assetCode)) {
    throw new AssetServiceError('Asset code may use letters, numbers, dots, underscores, hyphens and slashes.');
  }

  for (const field of DATE_FIELDS) {
    const value = input[field] ?? '';
    if (typeof value !== 'string' || (value !== '' && !isValidDate(value))) {
      throw new AssetServiceError(`${field === 'purchaseDate' ? 'Purchase date' : 'Installation date'} must be a valid date.`);
    }
    asset[field] = value;
  }
  if (asset.purchaseDate && asset.installationDate && asset.installationDate < asset.purchaseDate) {
    throw new AssetServiceError('Installation date cannot be before the purchase date.');
  }

  return asset;
}

function validateStoredCollection(value) {
  if (!Array.isArray(value)) throw new AssetServiceError('The asset data file must contain a list of assets.');
  const seenIds = new Set();
  const seenCodes = new Set();
  return value.map((record) => {
    if (!isRecord(record) || typeof record.id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(record.id)) {
      throw new AssetServiceError('An asset record has an invalid internal ID. No changes were saved.');
    }
    if (seenIds.has(record.id)) throw new AssetServiceError('The asset data contains duplicate internal IDs. No changes were saved.');
    seenIds.add(record.id);
    if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt))
      || typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) {
      throw new AssetServiceError('An asset record has invalid timestamps. No changes were saved.');
    }
    const fields = { ...record };
    delete fields.id;
    delete fields.createdAt;
    delete fields.updatedAt;
    const asset = normalizeAssetInput(fields);
    const codeKey = asset.assetCode.toLocaleUpperCase('en-US');
    if (seenCodes.has(codeKey)) throw new AssetServiceError('The asset data contains duplicate asset codes. No changes were saved.');
    seenCodes.add(codeKey);
    return { ...asset, id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt };
  });
}

function validateId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    throw new AssetServiceError('This asset could not be found. Refresh the list and try again.');
  }
}

function assertUniqueCode(assets, code, exceptId) {
  const duplicate = assets.find((asset) => asset.id !== exceptId
    && asset.assetCode.toLocaleUpperCase('en-US') === code.toLocaleUpperCase('en-US'));
  if (duplicate) throw new AssetServiceError(`Asset code ${code} is already in use.`);
}

function createAssetService(dataDirectory, serialize = createOperationQueue()) {
  const readAssets = async () => validateStoredCollection(await readCollection(dataDirectory, 'assets'));
  const saveAssets = (assets) => writeCollection(dataDirectory, 'assets', assets);

  return {
    listAssets() {
      return serialize(async () => (await readAssets()).sort((a, b) => a.assetCode.localeCompare(b.assetCode)));
    },
    getAsset(id) {
      return serialize(async () => {
        validateId(id);
        const asset = (await readAssets()).find((record) => record.id === id);
        if (!asset) throw new AssetServiceError('Asset not found. It may have been removed.');
        return asset;
      });
    },
    createAsset(input) {
      return serialize(async () => {
        const assets = await readAssets();
        const fields = normalizeAssetInput(input);
        assertUniqueCode(assets, fields.assetCode);
        const now = new Date().toISOString();
        const asset = { ...fields, id: randomUUID(), createdAt: now, updatedAt: now };
        await saveAssets([...assets, asset]);
        return asset;
      });
    },
    updateAsset(id, input) {
      return serialize(async () => {
        validateId(id);
        const assets = await readAssets();
        const index = assets.findIndex((record) => record.id === id);
        if (index === -1) throw new AssetServiceError('Asset not found. It may have been removed.');
        const fields = normalizeAssetInput(input);
        assertUniqueCode(assets, fields.assetCode, id);
        const asset = {
          ...fields,
          id: assets[index].id,
          createdAt: assets[index].createdAt,
          updatedAt: new Date(Math.max(Date.now(), Date.parse(assets[index].updatedAt) + 1)).toISOString(),
        };
        const updatedAssets = [...assets];
        updatedAssets[index] = asset;
        await saveAssets(updatedAssets);
        return asset;
      });
    },
    deleteAsset(id) {
      return serialize(async () => {
        validateId(id);
        const assets = await readAssets();
        const asset = assets.find((record) => record.id === id);
        if (!asset) throw new AssetServiceError('Asset not found. It may have been removed.');
        const maintenanceRecords = await readCollection(dataDirectory, 'maintenance');
        if (maintenanceRecords.some((record) => record?.assetId === id)) {
          throw new AssetServiceError('This asset has maintenance history and cannot be deleted.');
        }
        await saveAssets(assets.filter((record) => record.id !== id));
        return { id: asset.id, assetCode: asset.assetCode, name: asset.name };
      });
    },
  };
}

module.exports = { AssetServiceError, CATEGORIES: [...CATEGORIES], CONDITIONS: [...CONDITIONS], STATUSES: [...STATUSES], createAssetService };
