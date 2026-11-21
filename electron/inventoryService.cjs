const { randomUUID } = require('node:crypto');
const { readCollection, writeCollection } = require('./storage.cjs');

const CATEGORIES = new Set(['Chemicals', 'Spare Parts', 'Electrical Supplies', 'Plumbing Materials', 'Filters and Components', 'Tools', 'Other']);
const TEXT_LIMITS = Object.freeze({ itemCode: 40, name: 120, unit: 30, location: 160, supplier: 120, description: 2000 });
const FIELDS = Object.keys(TEXT_LIMITS);

class InventoryServiceError extends Error {
  constructor(message) { super(message); this.name = 'InventoryServiceError'; }
}

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function cleanText(field, value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new InventoryServiceError(`${field} must be text.`);
  const text = value.trim();
  if (text.length > TEXT_LIMITS[field] || (field !== 'description' && /[\u0000-\u001f\u007f]/.test(text)) || (field === 'description' && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))) {
    throw new InventoryServiceError(`${field} contains invalid text or is too long.`);
  }
  return field === 'itemCode' ? text.toUpperCase() : text;
}
function quantity(value, label, { allowZero = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (allowZero ? 0 : Number.EPSILON) || value > 1_000_000_000_000) {
    throw new InventoryServiceError(`${label} must be a valid ${allowZero ? 'zero or positive' : 'positive'} quantity.`);
  }
  return value;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function normalizeItem(input) {
  if (!isRecord(input)) throw new InventoryServiceError('Enter item information before saving.');
  for (const key of ['id', 'createdAt', 'updatedAt']) if (Object.hasOwn(input, key)) throw new InventoryServiceError(`${key} is assigned by SmartWater and cannot be changed here.`);
  const allowed = new Set([...FIELDS, 'category', 'currentStock', 'minimumStock']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new InventoryServiceError(`Unsupported inventory field: ${key}.`);
  const item = {};
  for (const field of FIELDS) item[field] = cleanText(field, input[field]);
  item.category = input.category ?? '';
  item.currentStock = quantity(input.currentStock ?? 0, 'Current stock');
  item.minimumStock = quantity(input.minimumStock ?? 0, 'Minimum stock');
  if (!item.itemCode) throw new InventoryServiceError('Item code is required.');
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(item.itemCode)) throw new InventoryServiceError('Item code may use letters, numbers, dots, underscores, hyphens and slashes.');
  if (!item.name) throw new InventoryServiceError('Item name is required.');
  if (!CATEGORIES.has(item.category)) throw new InventoryServiceError('Choose a valid inventory category.');
  if (!item.unit) throw new InventoryServiceError('Unit of measurement is required.');
  return item;
}
function normalizeStoredItems(data) {
  if (!Array.isArray(data)) throw new InventoryServiceError('The inventory data file must contain a list of items.');
  const ids = new Set(); const codes = new Set();
  return data.map((raw) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.id)) throw new InventoryServiceError('An inventory record has an invalid internal ID. No changes were saved.');
    const fields = { ...raw }; delete fields.id; delete fields.createdAt; delete fields.updatedAt;
    const item = normalizeItem(fields);
    if (ids.has(raw.id) || codes.has(item.itemCode)) throw new InventoryServiceError('Inventory contains duplicate IDs or item codes. No changes were saved.');
    if (typeof raw.createdAt !== 'string' || Number.isNaN(Date.parse(raw.createdAt)) || typeof raw.updatedAt !== 'string' || Number.isNaN(Date.parse(raw.updatedAt))) throw new InventoryServiceError('An inventory record has invalid timestamps. No changes were saved.');
    ids.add(raw.id); codes.add(item.itemCode);
    return { ...item, id: raw.id, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
  });
}
function normalizeTransactions(data) {
  if (!Array.isArray(data)) throw new InventoryServiceError('The transaction history file must contain a list.');
  return data.map((tx) => {
    if (!isRecord(tx) || !['IN', 'OUT'].includes(tx.transactionType) || typeof tx.itemId !== 'string' || typeof tx.itemCode !== 'string' || typeof tx.itemName !== 'string' || typeof tx.unit !== 'string' || !validDate(tx.date)) throw new InventoryServiceError('Transaction history contains an invalid record. No changes were saved.');
    quantity(tx.quantity, 'Transaction quantity', { allowZero: false }); quantity(tx.previousStock, 'Previous stock'); quantity(tx.newStock, 'New stock');
    return tx;
  });
}
function normalizeTransactionFilters(filters = {}) {
  if (!isRecord(filters)) throw new InventoryServiceError('Transaction filters are invalid.');
  const allowed = new Set(['itemId', 'transactionType', 'fromDate', 'toDate']);
  for (const field of Object.keys(filters)) if (!allowed.has(field)) throw new InventoryServiceError(`Unsupported transaction filter: ${field}.`);
  for (const field of ['itemId', 'transactionType', 'fromDate', 'toDate']) if (filters[field] !== undefined && typeof filters[field] !== 'string') throw new InventoryServiceError(`${field} filter must be text.`);
  if (filters.transactionType && !['IN', 'OUT'].includes(filters.transactionType)) throw new InventoryServiceError('Choose a valid transaction type.');
  for (const field of ['fromDate', 'toDate']) if (filters[field] && !validDate(filters[field])) throw new InventoryServiceError('Transaction date filter is invalid.');
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) throw new InventoryServiceError('Start date cannot be after end date.');
  return filters;
}

function createInventoryService(directory) {
  let queue = Promise.resolve();
  const serialize = (fn) => { const result = queue.then(fn, fn); queue = result.catch(() => {}); return result; };
  const readItems = async () => normalizeStoredItems(await readCollection(directory, 'inventory'));
  const readTransactions = async () => normalizeTransactions(await readCollection(directory, 'inventoryTransactions'));
  const savePair = async (items, transactions, oldItems, oldTransactions) => {
    await writeCollection(directory, 'inventory', items);
    try { await writeCollection(directory, 'inventoryTransactions', transactions); }
    catch (error) { await writeCollection(directory, 'inventory', oldItems).catch(() => {}); await writeCollection(directory, 'inventoryTransactions', oldTransactions).catch(() => {}); throw error; }
  };
  return {
    listItems() { return serialize(async () => (await readItems()).sort((a, b) => a.itemCode.localeCompare(b.itemCode))); },
    getItem(id) { return serialize(async () => { const item = (await readItems()).find((entry) => entry.id === id); if (!item) throw new InventoryServiceError('Inventory item not found.'); return item; }); },
    createItem(input) { return serialize(async () => { const items = await readItems(); const item = normalizeItem(input); if (items.some((entry) => entry.itemCode === item.itemCode)) throw new InventoryServiceError(`Item code ${item.itemCode} is already in use.`); const now = new Date().toISOString(); const created = { ...item, id: randomUUID(), createdAt: now, updatedAt: now }; await writeCollection(directory, 'inventory', [...items, created]); return created; }); },
    updateItem(id, input) { return serialize(async () => { const items = await readItems(); const index = items.findIndex((entry) => entry.id === id); if (index < 0) throw new InventoryServiceError('Inventory item not found.'); const item = normalizeItem(input); if (items.some((entry) => entry.id !== id && entry.itemCode === item.itemCode)) throw new InventoryServiceError(`Item code ${item.itemCode} is already in use.`); if (item.currentStock !== items[index].currentStock) throw new InventoryServiceError('Use Stock In or Stock Out to change available quantity.'); const updated = { ...item, id, createdAt: items[index].createdAt, updatedAt: new Date(Math.max(Date.now(), Date.parse(items[index].updatedAt) + 1)).toISOString() }; const next = [...items]; next[index] = updated; await writeCollection(directory, 'inventory', next); return updated; }); },
    deleteItem(id) { return serialize(async () => { const items = await readItems(); const transactions = await readTransactions(); const item = items.find((entry) => entry.id === id); if (!item) throw new InventoryServiceError('Inventory item not found.'); if (transactions.some((tx) => tx.itemId === id)) throw new InventoryServiceError('This item has stock transaction history and cannot be deleted.'); await writeCollection(directory, 'inventory', items.filter((entry) => entry.id !== id)); return { id, itemCode: item.itemCode, name: item.name }; }); },
    listTransactions(filters = {}) { return serialize(async () => { const selected = normalizeTransactionFilters(filters); const transactions = await readTransactions(); return transactions.filter((tx) => (!selected.itemId || tx.itemId === selected.itemId) && (!selected.transactionType || tx.transactionType === selected.transactionType) && (!selected.fromDate || tx.date >= selected.fromDate) && (!selected.toDate || tx.date <= selected.toDate)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); }); },
    stockIn(input) { return this.applyMovement(input, 'IN'); },
    stockOut(input) { return this.applyMovement(input, 'OUT'); },
    applyMovement(input, type) { return serialize(async () => {
      if (!isRecord(input)) throw new InventoryServiceError('Enter stock movement details.');
      const items = await readItems(); const transactions = await readTransactions();
      const itemIndex = items.findIndex((entry) => entry.id === input.itemId); if (itemIndex < 0) throw new InventoryServiceError('Select an inventory item.');
      const qty = quantity(input.quantity, 'Movement quantity', { allowZero: false });
      if (!validDate(input.date)) throw new InventoryServiceError('Enter a valid movement date.');
      const boundedText = (name, max) => { const value = input[name] ?? ''; if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new InventoryServiceError(`${name} is invalid or too long.`); return value.trim(); };
      const item = items[itemIndex]; const previousStock = item.currentStock;
      if (type === 'OUT' && qty > previousStock) throw new InventoryServiceError('Stock out quantity cannot exceed available stock.');
      const newStock = type === 'IN' ? previousStock + qty : previousStock - qty;
      if (!Number.isFinite(newStock) || newStock < 0) throw new InventoryServiceError('This movement would result in invalid stock.');
      const now = new Date().toISOString();
      const transaction = { id: randomUUID(), itemId: item.id, itemCode: item.itemCode, itemName: item.name, transactionType: type, quantity: qty, unit: item.unit, previousStock, newStock, date: input.date, referenceNumber: boundedText('referenceNumber', 100), partyOrSupplier: boundedText('partyOrSupplier', 120), notes: boundedText('notes', 1000), createdAt: now };
      const nextItems = [...items]; nextItems[itemIndex] = { ...item, currentStock: newStock, updatedAt: now };
      await savePair(nextItems, [...transactions, transaction], items, transactions);
      return { item: nextItems[itemIndex], transaction };
    }); },
  };
}

module.exports = { InventoryServiceError, CATEGORIES: [...CATEGORIES], createInventoryService };
