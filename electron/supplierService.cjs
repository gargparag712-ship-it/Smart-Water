const { randomUUID } = require('node:crypto');
const { readCollection, writeCollection } = require('./storage.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');

const CATEGORIES = new Set(['Chemicals', 'Spare Parts', 'Electrical Supplies', 'Plumbing Materials', 'Filters and Components', 'Tools', 'Other']);
const LIMITS = Object.freeze({ supplierCode: 24, name: 140, contactPerson: 120, phone: 40, email: 180, address: 400, notes: 2000 });
class SupplierServiceError extends Error { constructor(message) { super(message); this.name = 'SupplierServiceError'; } }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clean(value, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new SupplierServiceError(`${field} must be text.`);
  const normalized = value.trim();
  const controls = ['address', 'notes'].includes(field) ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (normalized.length > LIMITS[field] || controls.test(normalized)) throw new SupplierServiceError(`${field} contains invalid text or is too long.`);
  return normalized;
}
function normalizeSupplier(input) {
  if (!isRecord(input)) throw new SupplierServiceError('Enter supplier details before saving.');
  const allowed = new Set(['name', 'contactPerson', 'phone', 'email', 'address', 'suppliedCategories', 'notes']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new SupplierServiceError(`Unsupported supplier field: ${key}.`);
  const supplier = {};
  for (const field of ['name', 'contactPerson', 'phone', 'email', 'address', 'notes']) supplier[field] = clean(input[field], field);
  if (!supplier.name) throw new SupplierServiceError('Supplier name is required.');
  if (supplier.phone && (!/^\+?[\d\s().-]{7,24}$/.test(supplier.phone) || (supplier.phone.match(/\d/g) || []).length < 7)) throw new SupplierServiceError('Enter a valid phone number.');
  if (supplier.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email)) throw new SupplierServiceError('Enter a valid email address.');
  if (!Array.isArray(input.suppliedCategories) || input.suppliedCategories.some((category) => typeof category !== 'string' || !CATEGORIES.has(category))) throw new SupplierServiceError('Choose valid supplied categories.');
  supplier.suppliedCategories = [...new Set(input.suppliedCategories)];
  return supplier;
}
function validateStoredSuppliers(data) {
  if (!Array.isArray(data)) throw new SupplierServiceError('The supplier data file must contain a list.');
  const ids = new Set(); const codes = new Set();
  return data.map((raw) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.id) || typeof raw.supplierCode !== 'string' || !raw.supplierCode) throw new SupplierServiceError('A supplier has an invalid ID or code. No changes were saved.');
    if (ids.has(raw.id) || codes.has(raw.supplierCode)) throw new SupplierServiceError('Supplier records contain duplicate IDs or codes. No changes were saved.');
    if (typeof raw.createdAt !== 'string' || Number.isNaN(Date.parse(raw.createdAt)) || typeof raw.updatedAt !== 'string' || Number.isNaN(Date.parse(raw.updatedAt))) throw new SupplierServiceError('A supplier has invalid timestamps. No changes were saved.');
    const supplier = normalizeSupplier({ name: raw.name, contactPerson: raw.contactPerson, phone: raw.phone, email: raw.email, address: raw.address, suppliedCategories: raw.suppliedCategories ?? [], notes: raw.notes });
    ids.add(raw.id); codes.add(raw.supplierCode);
    return { ...supplier, id: raw.id, supplierCode: raw.supplierCode, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
  });
}

function createSupplierService(directory, serialize = createOperationQueue()) {
  const readSuppliers = async () => validateStoredSuppliers(await readCollection(directory, 'suppliers'));
  const saveSuppliers = (rows) => writeCollection(directory, 'suppliers', rows);
  const withCounts = async (suppliers) => {
    const items = await readCollection(directory, 'inventory');
    if (!Array.isArray(items)) throw new SupplierServiceError('The inventory data file is invalid.');
    const counts = new Map();
    for (const item of items) if (typeof item?.supplierId === 'string' && item.supplierId) counts.set(item.supplierId, (counts.get(item.supplierId) || 0) + 1);
    return suppliers.map((supplier) => ({ ...supplier, inventoryItemCount: counts.get(supplier.id) || 0 }));
  };
  return {
    listSuppliers() { return serialize(async () => withCounts((await readSuppliers()).sort((a, b) => a.name.localeCompare(b.name)))); },
    getSupplier(id) { return serialize(async () => { const supplier = (await readSuppliers()).find((row) => row.id === id); if (!supplier) throw new SupplierServiceError('Supplier not found.'); return { ...(await withCounts([supplier]))[0] }; }); },
    createSupplier(input) { return serialize(async () => {
      const supplier = normalizeSupplier(input); const rows = await readSuppliers(); const now = new Date().toISOString();
      const prefix = `SUP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-`;
      const sequence = rows.filter((row) => row.supplierCode.startsWith(prefix)).map((row) => Number(row.supplierCode.slice(prefix.length))).filter(Number.isSafeInteger);
      const created = { ...supplier, id: randomUUID(), supplierCode: `${prefix}${String(Math.max(0, ...sequence) + 1).padStart(4, '0')}`, createdAt: now, updatedAt: now };
      await saveSuppliers([...rows, created]); return { ...created, inventoryItemCount: 0 };
    }); },
    updateSupplier(id, input) { return serialize(async () => {
      const rows = await readSuppliers(); const index = rows.findIndex((row) => row.id === id); if (index < 0) throw new SupplierServiceError('Supplier not found.');
      const supplier = normalizeSupplier(input); const updated = { ...supplier, id, supplierCode: rows[index].supplierCode, createdAt: rows[index].createdAt, updatedAt: new Date(Math.max(Date.now(), Date.parse(rows[index].updatedAt) + 1)).toISOString() };
      const next = [...rows]; next[index] = updated; await saveSuppliers(next); return (await withCounts([updated]))[0];
    }); },
    deleteSupplier(id) { return serialize(async () => {
      const rows = await readSuppliers(); const supplier = rows.find((row) => row.id === id); if (!supplier) throw new SupplierServiceError('Supplier not found.');
      const items = await readCollection(directory, 'inventory');
      if (items.some((item) => item?.supplierId === id)) throw new SupplierServiceError('This supplier is linked to inventory items and cannot be deleted. Update those items first.');
      await saveSuppliers(rows.filter((row) => row.id !== id)); return { id, supplierCode: supplier.supplierCode, name: supplier.name };
    }); },
  };
}

module.exports = { SupplierServiceError, SUPPLIED_CATEGORIES: [...CATEGORIES], createSupplierService };
