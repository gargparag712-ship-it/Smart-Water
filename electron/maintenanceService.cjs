const { randomUUID } = require('node:crypto');
const { readCollection, writeCollection } = require('./storage.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');
const { summarizeMaintenance } = require('./maintenanceDates.cjs');

const TYPES = new Set(['Preventive', 'Corrective']);
const PRIORITIES = new Set(['Low', 'Medium', 'High', 'Critical']);
const STATUSES = new Set(['Scheduled', 'In Progress', 'Completed', 'Cancelled']);
const LIMITS = Object.freeze({ title: 160, description: 3000, assignedTo: 120, workPerformed: 3000, remarks: 2000 });
const EDITABLE_FIELDS = new Set(['assetId', 'maintenanceType', 'title', 'description', 'priority', 'scheduledDate', 'assignedTo', 'remarks']);

class MaintenanceServiceError extends Error {
  constructor(message) { super(message); this.name = 'MaintenanceServiceError'; }
}
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function text(value, field, max = LIMITS[field]) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new MaintenanceServiceError(`${field} must be text.`);
  const normalized = value.trim();
  const controls = field === 'description' || field === 'workPerformed' || field === 'remarks'
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  if (normalized.length > max || controls.test(normalized)) throw new MaintenanceServiceError(`${field} contains invalid text or is too long.`);
  return normalized;
}
function cost(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) throw new MaintenanceServiceError(`${label} must be a valid zero or positive amount.`);
  return value;
}
function normalizeWorkOrder(input, { allowSystemFields = false } = {}) {
  if (!isRecord(input)) throw new MaintenanceServiceError('Enter work order information before saving.');
  const allowed = new Set([...EDITABLE_FIELDS, ...(allowSystemFields ? ['workOrderCode', 'id', 'assetCode', 'assetName', 'status', 'completionDate', 'labourCost', 'partsCost', 'totalCost', 'workPerformed', 'createdAt', 'updatedAt'] : [])]);
  for (const field of Object.keys(input)) if (!allowed.has(field)) throw new MaintenanceServiceError(`Unsupported maintenance field: ${field}.`);
  const record = {
    assetId: input.assetId,
    maintenanceType: input.maintenanceType,
    title: text(input.title, 'title'),
    description: text(input.description, 'description'),
    priority: input.priority,
    scheduledDate: input.scheduledDate,
    assignedTo: text(input.assignedTo, 'assignedTo'),
    remarks: text(input.remarks, 'remarks'),
  };
  if (typeof record.assetId !== 'string' || !record.assetId) throw new MaintenanceServiceError('Select an existing asset.');
  if (!TYPES.has(record.maintenanceType)) throw new MaintenanceServiceError('Choose a valid maintenance type.');
  if (!record.title) throw new MaintenanceServiceError('Work order title is required.');
  if (!PRIORITIES.has(record.priority)) throw new MaintenanceServiceError('Choose a valid priority.');
  if (!validDate(record.scheduledDate)) throw new MaintenanceServiceError('Enter a valid scheduled date.');
  return record;
}
function validateStoredRecords(records) {
  if (!Array.isArray(records)) throw new MaintenanceServiceError('The maintenance data file must contain a list of work orders.');
  const ids = new Set(); const codes = new Set();
  return records.map((record) => {
    if (!isRecord(record) || typeof record.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(record.id)) throw new MaintenanceServiceError('A work order has an invalid internal ID. No changes were saved.');
    if (ids.has(record.id) || typeof record.workOrderCode !== 'string' || codes.has(record.workOrderCode)) throw new MaintenanceServiceError('Maintenance contains duplicate IDs or work order codes. No changes were saved.');
    if (!STATUSES.has(record.status) || !validDate(record.scheduledDate)) throw new MaintenanceServiceError('A work order has invalid status or dates. No changes were saved.');
    if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt)) || typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) throw new MaintenanceServiceError('A work order has invalid timestamps. No changes were saved.');
    const base = normalizeWorkOrder({ assetId: record.assetId, maintenanceType: record.maintenanceType, title: record.title, description: record.description, priority: record.priority, scheduledDate: record.scheduledDate, assignedTo: record.assignedTo, remarks: record.remarks });
    const completionDate = record.completionDate || '';
    const workPerformed = text(record.workPerformed, 'workPerformed');
    const labourCost = cost(record.labourCost ?? 0, 'Labour cost');
    const partsCost = cost(record.partsCost ?? 0, 'Parts cost');
    const totalCost = cost(record.totalCost ?? 0, 'Total cost');
    if (record.status === 'Completed' && (!validDate(completionDate) || totalCost !== labourCost + partsCost)) throw new MaintenanceServiceError('A completed work order has invalid completion details. No changes were saved.');
    if (record.status !== 'Completed' && (completionDate || workPerformed || labourCost || partsCost || totalCost)) throw new MaintenanceServiceError('An unfinished work order contains completion details. No changes were saved.');
    ids.add(record.id); codes.add(record.workOrderCode);
    return { ...base, id: record.id, workOrderCode: record.workOrderCode, assetCode: text(record.assetCode, 'assetCode', 40), assetName: text(record.assetName, 'assetName', 120), status: record.status, completionDate, labourCost, partsCost, totalCost, workPerformed, createdAt: record.createdAt, updatedAt: record.updatedAt };
  });
}
function localToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function normalizeFilters(filters = {}) {
  if (!isRecord(filters)) throw new MaintenanceServiceError('Maintenance filters are invalid.');
  const allowed = new Set(['search', 'maintenanceType', 'status', 'priority', 'fromDate', 'toDate', 'assetId']);
  for (const field of Object.keys(filters)) if (!allowed.has(field)) throw new MaintenanceServiceError(`Unsupported maintenance filter: ${field}.`);
  if (filters.maintenanceType && !TYPES.has(filters.maintenanceType)) throw new MaintenanceServiceError('Choose a valid maintenance type filter.');
  if (filters.status && !STATUSES.has(filters.status)) throw new MaintenanceServiceError('Choose a valid status filter.');
  if (filters.priority && !PRIORITIES.has(filters.priority)) throw new MaintenanceServiceError('Choose a valid priority filter.');
  for (const key of ['search', 'assetId', 'fromDate', 'toDate']) if (filters[key] !== undefined && typeof filters[key] !== 'string') throw new MaintenanceServiceError(`${key} filter must be text.`);
  for (const key of ['fromDate', 'toDate']) if (filters[key] && !validDate(filters[key])) throw new MaintenanceServiceError('Maintenance date filter is invalid.');
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) throw new MaintenanceServiceError('Start date cannot be after end date.');
  return filters;
}

function createMaintenanceService(dataDirectory, serialize = createOperationQueue()) {
  const readRecords = async () => validateStoredRecords(await readCollection(dataDirectory, 'maintenance'));
  const readAssets = async () => {
    const assets = await readCollection(dataDirectory, 'assets');
    if (!Array.isArray(assets)) throw new MaintenanceServiceError('The asset data file is invalid.');
    return assets;
  };
  const getAsset = async (id) => {
    const asset = (await readAssets()).find((entry) => entry?.id === id);
    if (!asset || typeof asset.assetCode !== 'string' || typeof asset.name !== 'string') throw new MaintenanceServiceError('The selected asset does not exist. Choose an asset from Asset Management.');
    return asset;
  };
  const save = (records) => writeCollection(dataDirectory, 'maintenance', records);
  const makeCode = (records) => {
    const day = localToday().replaceAll('-', '');
    const prefix = `WO-${day}-`;
    const numbers = records.filter((record) => record.workOrderCode.startsWith(prefix)).map((record) => Number(record.workOrderCode.slice(prefix.length))).filter(Number.isSafeInteger);
    return `${prefix}${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
  };
  return {
    listRecords(filters = {}) { return serialize(async () => {
      const selected = normalizeFilters(filters); const records = await readRecords(); const query = (selected.search || '').trim().toLocaleLowerCase();
      return records.filter((record) => (!selected.maintenanceType || record.maintenanceType === selected.maintenanceType) && (!selected.status || record.status === selected.status) && (!selected.priority || record.priority === selected.priority) && (!selected.assetId || record.assetId === selected.assetId) && (!selected.fromDate || record.scheduledDate >= selected.fromDate) && (!selected.toDate || record.scheduledDate <= selected.toDate) && (!query || [record.workOrderCode, record.assetCode, record.assetName, record.title, record.assignedTo].some((value) => value.toLocaleLowerCase().includes(query)))).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.workOrderCode.localeCompare(b.workOrderCode));
    }); },
    getRecord(id) { return serialize(async () => { const record = (await readRecords()).find((entry) => entry.id === id); if (!record) throw new MaintenanceServiceError('Work order not found.'); return record; }); },
    listAssetHistory(assetId) { return serialize(async () => { if (typeof assetId !== 'string' || !assetId) throw new MaintenanceServiceError('Choose an asset to view maintenance history.'); return (await readRecords()).filter((record) => record.assetId === assetId).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)); }); },
    getSummary() { return serialize(async () => summarizeMaintenance(await readRecords(), localToday())); },
    createRecord(input) { return serialize(async () => { const fields = normalizeWorkOrder(input); const asset = await getAsset(fields.assetId); const records = await readRecords(); const now = new Date().toISOString(); const record = { ...fields, workOrderCode: makeCode(records), id: randomUUID(), assetCode: asset.assetCode, assetName: asset.name, status: 'Scheduled', completionDate: '', labourCost: 0, partsCost: 0, totalCost: 0, workPerformed: '', createdAt: now, updatedAt: now }; await save([...records, record]); return record; }); },
    updateRecord(id, input) { return serialize(async () => {
      const records = await readRecords(); const index = records.findIndex((record) => record.id === id); if (index < 0) throw new MaintenanceServiceError('Work order not found.');
      if (records[index].status === 'Completed' || records[index].status === 'Cancelled') throw new MaintenanceServiceError('Completed or cancelled work orders are preserved and cannot be edited.');
      const fields = normalizeWorkOrder(input); const asset = await getAsset(fields.assetId); const updated = { ...records[index], ...fields, assetCode: asset.assetCode, assetName: asset.name, updatedAt: new Date(Math.max(Date.now(), Date.parse(records[index].updatedAt) + 1)).toISOString() }; const next = [...records]; next[index] = updated; await save(next); return updated;
    }); },
    updateStatus(id, input) { return serialize(async () => {
      if (!isRecord(input) || typeof input.status !== 'string') throw new MaintenanceServiceError('Choose a valid work order status.');
      const records = await readRecords(); const index = records.findIndex((record) => record.id === id); if (index < 0) throw new MaintenanceServiceError('Work order not found.');
      const current = records[index]; const allowed = current.status === 'Scheduled' ? ['In Progress', 'Cancelled'] : current.status === 'In Progress' ? ['Completed'] : [];
      if (!allowed.includes(input.status)) throw new MaintenanceServiceError(`Cannot change a ${current.status.toLowerCase()} work order to ${input.status}.`);
      let completion = {};
      if (input.status === 'Completed') {
        const allowedCompletionFields = new Set(['status', 'completionDate', 'workPerformed', 'labourCost', 'partsCost']);
        if (Object.keys(input).some((key) => !allowedCompletionFields.has(key))) throw new MaintenanceServiceError('Unsupported completion information was provided.');
        if (!validDate(input.completionDate)) throw new MaintenanceServiceError('Enter a valid completion date.');
        const workPerformed = text(input.workPerformed, 'workPerformed'); if (!workPerformed) throw new MaintenanceServiceError('Describe the work performed before completing this order.');
        const labourCost = cost(input.labourCost, 'Labour cost'); const partsCost = cost(input.partsCost, 'Parts cost');
        completion = { completionDate: input.completionDate, workPerformed, labourCost, partsCost, totalCost: labourCost + partsCost };
      } else if (Object.keys(input).some((key) => key !== 'status')) throw new MaintenanceServiceError('This status change does not accept completion details.');
      const updated = { ...current, ...completion, status: input.status, updatedAt: new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString() };
      const next = [...records]; next[index] = updated; await save(next); return updated;
    }); },
    listAssets() { return serialize(async () => readAssets()); },
  };
}

module.exports = { MaintenanceServiceError, TYPES: [...TYPES], PRIORITIES: [...PRIORITIES], STATUSES: [...STATUSES], createMaintenanceService, localToday };
