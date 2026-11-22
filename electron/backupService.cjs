const { readCollection, writeCollection } = require('./storage.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');
const { validateStoredCollection } = require('./assetsService.cjs');
const { normalizeStoredItems, normalizeTransactions } = require('./inventoryService.cjs');
const { validateStoredRecords } = require('./maintenanceService.cjs');
const { validateStoredTransactions, validateStoredBudgets } = require('./financeService.cjs');
const { validateStoredSuppliers } = require('./supplierService.cjs');

const FORMAT = 'smartwater-backup';
const VERSION = 1;
const COLLECTIONS = ['assets', 'inventory', 'inventoryTransactions', 'maintenance', 'finances', 'budgets', 'suppliers'];
class BackupServiceError extends Error { constructor(message) { super(message); this.name = 'BackupServiceError'; } }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function checkUnique(rows, field, label, caseInsensitive = false) {
  const seen = new Set();
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id) throw new BackupServiceError(`${label} contains an invalid record.`);
    if (seen.has(row.id)) throw new BackupServiceError(`${label} contains duplicate IDs.`);
    seen.add(row.id);
  }
  if (!field) return;
  const codes = new Set();
  for (const row of rows) {
    const value = row[field];
    if (typeof value !== 'string' || !value.trim()) throw new BackupServiceError(`${label} contains a record without ${field}.`);
    const key = caseInsensitive ? value.toLocaleUpperCase() : value;
    if (codes.has(key)) throw new BackupServiceError(`${label} contains duplicate ${field} values.`);
    codes.add(key);
  }
}
function validateCollections(collections) {
  if (!isRecord(collections) || Object.keys(collections).length !== COLLECTIONS.length || COLLECTIONS.some((name) => !Object.hasOwn(collections, name) || !Array.isArray(collections[name]))) throw new BackupServiceError('Backup is incomplete or contains unsupported collections.');
  for (const name of COLLECTIONS) for (const row of collections[name]) if (!isRecord(row)) throw new BackupServiceError(`${name} must contain JSON records.`);
  validateStoredCollection(collections.assets);
  normalizeStoredItems(collections.inventory);
  checkUnique(collections.inventoryTransactions, null, 'Inventory transactions');
  normalizeTransactions(collections.inventoryTransactions);
  validateStoredRecords(collections.maintenance);
  validateStoredTransactions(collections.finances);
  validateStoredBudgets(collections.budgets);
  validateStoredSuppliers(collections.suppliers);
  const assetIds = new Set(collections.assets.map((row) => row.id));
  const itemIds = new Set(collections.inventory.map((row) => row.id));
  const orderIds = new Set(collections.maintenance.map((row) => row.id));
  const supplierIds = new Set(collections.suppliers.map((row) => row.id));
  for (const row of collections.inventory) if (row.supplierId && !supplierIds.has(row.supplierId)) throw new BackupServiceError('Inventory contains a reference to a missing supplier.');
  for (const row of collections.maintenance) if (row.assetId && !assetIds.has(row.assetId)) throw new BackupServiceError('Maintenance contains a reference to a missing asset.');
  for (const row of collections.inventoryTransactions) if (row.itemId && !itemIds.has(row.itemId)) throw new BackupServiceError('Stock history contains a reference to a missing inventory item.');
  for (const row of collections.finances) if (row.relatedWorkOrderId && !orderIds.has(row.relatedWorkOrderId)) throw new BackupServiceError('Finance contains a reference to a missing work order.');
  return collections;
}
function validateBackup(payload) {
  if (!isRecord(payload) || payload.format !== FORMAT || payload.version !== VERSION || typeof payload.createdAt !== 'string' || Number.isNaN(Date.parse(payload.createdAt))) throw new BackupServiceError('This file is not a supported SmartWater backup.');
  validateCollections(payload.collections);
  return payload;
}
function createBackupService(dataDirectory, serialize = createOperationQueue()) {
  async function readAll() {
    const values = await Promise.all(COLLECTIONS.map((name) => readCollection(dataDirectory, name)));
    return Object.fromEntries(COLLECTIONS.map((name, index) => [name, values[index]]));
  }
  return {
    createBackup(createdAt = new Date().toISOString()) { return serialize(async () => ({ format: FORMAT, version: VERSION, createdAt, collections: validateCollections(await readAll()) })); },
    restoreBackup(payload) { return serialize(async () => {
      const backup = validateBackup(payload);
      const before = await readAll();
      try {
        for (const name of COLLECTIONS) await writeCollection(dataDirectory, name, backup.collections[name]);
      } catch (error) {
        for (const name of COLLECTIONS) await writeCollection(dataDirectory, name, before[name]).catch(() => {});
        throw error;
      }
      return { collectionCount: COLLECTIONS.length };
    }); },
  };
}
module.exports = { BackupServiceError, FORMAT, VERSION, COLLECTIONS, validateCollections, validateBackup, createBackupService };
