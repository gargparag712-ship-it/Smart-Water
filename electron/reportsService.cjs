const { readCollection } = require('./storage.cjs');
const { getMaintenanceDateStatus } = require('./maintenanceDates.cjs');

const REPORTS = Object.freeze({
  assets: 'Asset Report', inventory: 'Inventory Report', stockMovements: 'Stock Movement Report',
  maintenance: 'Maintenance Report', finance: 'Finance Report', monthlySummary: 'Monthly Operational Summary',
});
class ReportsServiceError extends Error { constructor(message) { super(message); this.name = 'ReportsServiceError'; } }
function localDateString(date = new Date()) { const value = new Date(date.getTime()); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); }
function validDate(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value; }
function normalizeFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new ReportsServiceError('Report filters are invalid.');
  const allowed = new Set(['fromDate', 'toDate', 'category', 'status', 'search', 'transactionType', 'itemId']);
  for (const key of Object.keys(filters)) if (!allowed.has(key)) throw new ReportsServiceError(`Unsupported report filter: ${key}.`);
  for (const key of ['fromDate', 'toDate']) if (filters[key] !== undefined && filters[key] !== '' && !validDate(filters[key])) throw new ReportsServiceError('Enter valid report dates.');
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) throw new ReportsServiceError('Start date cannot be after end date.');
  for (const key of ['category', 'status', 'search', 'transactionType', 'itemId']) if (filters[key] !== undefined && typeof filters[key] !== 'string') throw new ReportsServiceError(`${key} filter must be text.`);
  if (filters.transactionType && !['IN', 'OUT'].includes(filters.transactionType)) throw new ReportsServiceError('Choose a valid stock movement type.');
  return filters;
}
function inDateRange(date, filters) { return (!filters.fromDate || date >= filters.fromDate) && (!filters.toDate || date <= filters.toDate); }
function searchMatches(row, fields, query) { return !query || fields.some((field) => String(row[field] ?? '').toLocaleLowerCase().includes(query)); }
function matchesInventoryStatus(item, status) {
  if (!status) return true;
  if (status === 'Out of stock') return item.currentStock === 0;
  if (status === 'Low stock') return item.currentStock > 0 && item.currentStock <= item.minimumStock;
  if (status === 'In stock') return item.currentStock > item.minimumStock;
  return true;
}
function groupCount(rows, field) {
  const map = new Map(); rows.forEach((row) => { const key = row[field] || 'Unspecified'; map.set(key, (map.get(key) || 0) + 1); });
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
function sum(rows, selector) { return rows.reduce((total, row) => total + selector(row), 0); }
function monthLabel(key) { const [year, month] = key.split('-').map(Number); return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1)); }
function makeMonths(rows, fromDate, toDate) {
  const from = fromDate || rows.map((row) => row.date).filter(Boolean).sort()[0] || localDateString();
  const to = toDate || localDateString();
  const [fy, fm] = from.slice(0, 7).split('-').map(Number); const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  const keys = []; let cursor = new Date(fy, fm - 1, 1); const end = new Date(ty, tm - 1, 1);
  while (cursor <= end && keys.length < 60) { keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`); cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); }
  return keys.map((key) => { const matching = rows.filter((row) => row.date?.slice(0, 7) === key); return { label: monthLabel(key), incomePaise: sum(matching.filter((row) => row.type === 'Income'), (row) => row.amountPaise), expensePaise: sum(matching.filter((row) => row.type === 'Expense'), (row) => row.amountPaise) }; });
}
function buildReportData(type, filters, collections, generatedAt = new Date()) {
  if (!Object.hasOwn(REPORTS, type)) throw new ReportsServiceError('Choose a valid report type.');
  const f = normalizeFilters(filters); const query = (f.search || '').trim().toLocaleLowerCase(); const today = localDateString(generatedAt);
  const report = { type, title: REPORTS[type], generatedAt: generatedAt.toISOString(), dateRange: { from: f.fromDate || '', to: f.toDate || '' }, metrics: [], sections: [], charts: [] };
  if (type === 'assets' || type === 'monthlySummary') {
    const assets = collections.assets.filter((asset) => (!f.category || asset.category === f.category) && (!f.status || asset.status === f.status) && searchMatches(asset, ['assetCode', 'name', 'category', 'scheme', 'location'], query));
    report.metrics.push({ label: 'Total assets', value: assets.length }, { label: 'Active assets', value: assets.filter((asset) => asset.status === 'Active').length });
    const categoryCounts = groupCount(assets, 'category'); const conditionCounts = groupCount(assets, 'condition'); const statusCounts = groupCount(assets, 'status');
    report.sections.push({ title: 'Assets by category', columns: [{ key: 'label', label: 'Category' }, { key: 'value', label: 'Assets' }], rows: categoryCounts }, { title: 'Assets by condition', columns: [{ key: 'label', label: 'Condition' }, { key: 'value', label: 'Assets' }], rows: conditionCounts }, { title: 'Assets by operational status', columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Assets' }], rows: statusCounts }, { title: 'Asset register', columns: [{ key: 'assetCode', label: 'Asset code' }, { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, { key: 'condition', label: 'Condition' }, { key: 'status', label: 'Status' }, { key: 'location', label: 'Location' }], rows: assets });
    report.charts.push({ title: 'Assets by category', points: categoryCounts });
  }
  if (type === 'inventory' || type === 'monthlySummary') {
    const items = collections.inventory.filter((item) => (!f.category || item.category === f.category) && matchesInventoryStatus(item, f.status) && searchMatches(item, ['itemCode', 'name', 'category', 'location', 'supplier'], query));
    const low = items.filter((item) => item.currentStock <= item.minimumStock); const out = items.filter((item) => item.currentStock === 0);
    report.metrics.push({ label: 'Inventory items', value: items.length }, { label: 'Low stock items', value: low.length }, { label: 'Out of stock', value: out.length });
    const categoryRows = [...new Set(items.map((item) => item.category))].map((category) => { const group = items.filter((item) => item.category === category); return { category, itemCount: group.length, lowStock: group.filter((item) => item.currentStock <= item.minimumStock).length, zeroStock: group.filter((item) => item.currentStock === 0).length }; });
    report.sections.push({ title: 'Inventory category summary', columns: [{ key: 'category', label: 'Category' }, { key: 'itemCount', label: 'Items' }, { key: 'lowStock', label: 'Low stock' }, { key: 'zeroStock', label: 'Out of stock' }], rows: categoryRows }, { title: 'Inventory on hand', columns: [{ key: 'itemCode', label: 'Item code' }, { key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'currentStock', label: 'Current stock' }, { key: 'unit', label: 'Unit' }, { key: 'minimumStock', label: 'Minimum' }, { key: 'supplier', label: 'Supplier' }], rows: items });
    report.charts.push({ title: 'Inventory items by category', points: groupCount(items, 'category') });
  }
  if (type === 'stockMovements') {
    const itemById = new Map(collections.inventory.map((item) => [item.id, item]));
    const transactions = collections.inventoryTransactions.filter((tx) => inDateRange(tx.date, f) && (!f.transactionType || tx.transactionType === f.transactionType) && (!f.itemId || tx.itemId === f.itemId) && (!f.category || itemById.get(tx.itemId)?.category === f.category) && searchMatches(tx, ['itemCode', 'itemName', 'referenceNumber', 'partyOrSupplier', 'notes'], query)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    report.metrics.push({ label: 'Total movements', value: transactions.length }, { label: 'Stock In', value: transactions.filter((tx) => tx.transactionType === 'IN').length }, { label: 'Stock Out', value: transactions.filter((tx) => tx.transactionType === 'OUT').length });
    report.sections.push({ title: 'Stock movement history', columns: [{ key: 'date', label: 'Date' }, { key: 'itemCode', label: 'Item code' }, { key: 'itemName', label: 'Item' }, { key: 'transactionType', label: 'Type' }, { key: 'quantity', label: 'Quantity' }, { key: 'previousStock', label: 'Previous stock' }, { key: 'newStock', label: 'New stock' }, { key: 'referenceNumber', label: 'Reference' }, { key: 'partyOrSupplier', label: 'Party / supplier' }], rows: transactions });
    const perItem = [...new Set(transactions.map((tx) => tx.itemId))].map((id) => { const movements = transactions.filter((tx) => tx.itemId === id); return { itemCode: movements[0].itemCode, itemName: movements[0].itemName, stockIn: sum(movements.filter((tx) => tx.transactionType === 'IN'), (tx) => tx.quantity), stockOut: sum(movements.filter((tx) => tx.transactionType === 'OUT'), (tx) => tx.quantity), unit: movements[0].unit }; });
    report.sections.push({ title: 'Movement totals by item', columns: [{ key: 'itemCode', label: 'Item code' }, { key: 'itemName', label: 'Item' }, { key: 'stockIn', label: 'Stock In' }, { key: 'stockOut', label: 'Stock Out' }, { key: 'unit', label: 'Unit' }], rows: perItem });
  }
  if (type === 'maintenance' || type === 'monthlySummary') {
    const records = collections.maintenance.filter((row) => inDateRange(row.scheduledDate, f) && (!f.status || row.status === f.status) && searchMatches(row, ['workOrderCode', 'assetCode', 'assetName', 'title', 'assignedTo'], query));
    const overdue = records.filter((row) => getMaintenanceDateStatus(row, today) === 'overdue');
    report.metrics.push({ label: 'Total work orders', value: records.length }, { label: 'Scheduled', value: records.filter((row) => row.status === 'Scheduled').length }, { label: 'In progress', value: records.filter((row) => row.status === 'In Progress').length }, { label: 'Completed', value: records.filter((row) => row.status === 'Completed').length }, { label: 'Cancelled', value: records.filter((row) => row.status === 'Cancelled').length }, { label: 'Overdue', value: overdue.length }, { label: 'Completed maintenance costs', value: Math.round(sum(records.filter((row) => row.status === 'Completed'), (row) => row.totalCost || 0) * 100), format: 'money' });
    report.sections.push({ title: 'Maintenance work orders', columns: [{ key: 'workOrderCode', label: 'Work order' }, { key: 'scheduledDate', label: 'Scheduled' }, { key: 'assetCode', label: 'Asset code' }, { key: 'assetName', label: 'Asset' }, { key: 'title', label: 'Work' }, { key: 'maintenanceType', label: 'Type' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'assignedTo', label: 'Assigned to' }, { key: 'totalCost', label: 'Cost', format: 'rupees' }], rows: records });
    report.charts.push({ title: 'Maintenance by status', points: groupCount(records, 'status') });
  }
  if (type === 'finance' || type === 'monthlySummary') {
    const transactions = collections.finances.filter((row) => inDateRange(row.date, f) && (!f.category || row.category === f.category) && (!f.transactionType || row.type === (f.transactionType === 'IN' ? 'Income' : 'Expense')) && searchMatches(row, ['transactionCode', 'title', 'category', 'partyName', 'referenceNumber', 'relatedWorkOrderCode'], query)).sort((a, b) => b.date.localeCompare(a.date));
    const income = sum(transactions.filter((row) => row.type === 'Income'), (row) => row.amountPaise); const expenses = sum(transactions.filter((row) => row.type === 'Expense'), (row) => row.amountPaise);
    report.metrics.push({ label: 'Total income', value: income, format: 'money' }, { label: 'Total expenses', value: expenses, format: 'money' }, { label: 'Net balance', value: income - expenses, format: 'money' });
    const expensesByCategory = [...new Set(transactions.filter((row) => row.type === 'Expense').map((row) => row.category))].map((category) => ({ category, amountPaise: sum(transactions.filter((row) => row.type === 'Expense' && row.category === category), (row) => row.amountPaise) })).sort((a, b) => b.amountPaise - a.amountPaise);
    report.sections.push({ title: 'Expenses by category', columns: [{ key: 'category', label: 'Category' }, { key: 'amountPaise', label: 'Expense total', format: 'money' }], rows: expensesByCategory }, { title: 'Financial transactions', columns: [{ key: 'date', label: 'Date' }, { key: 'transactionCode', label: 'Reference' }, { key: 'type', label: 'Type' }, { key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'partyName', label: 'Party' }, { key: 'paymentMethod', label: 'Payment' }, { key: 'amountPaise', label: 'Amount', format: 'money' }, { key: 'relatedWorkOrderCode', label: 'Work order' }], rows: transactions });
    report.charts.push({ title: 'Monthly income and expenses', points: makeMonths(transactions, f.fromDate, f.toDate).map((point) => ({ label: point.label, income: point.incomePaise, expenses: point.expensePaise })) });
  }
  return report;
}
async function getReportData(dataDirectory, type, filters = {}, generatedAt = new Date()) {
  const names = ['assets', 'inventory', 'inventoryTransactions', 'maintenance', 'finances'];
  const values = await Promise.all(names.map((name) => readCollection(dataDirectory, name)));
  const collections = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  for (const [name, rows] of Object.entries(collections)) if (!Array.isArray(rows)) throw new ReportsServiceError(`The ${name} collection is invalid.`);
  return buildReportData(type, normalizeFilters(filters), collections, generatedAt);
}
module.exports = { ReportsServiceError, REPORTS, buildReportData, getReportData, localDateString, normalizeFilters };
