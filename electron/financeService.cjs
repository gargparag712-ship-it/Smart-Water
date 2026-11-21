const { randomUUID } = require('node:crypto');
const { readCollection, writeCollection } = require('./storage.cjs');
const { createOperationQueue } = require('./operationQueue.cjs');

const CATEGORIES = Object.freeze({
  Income: ['Government Grant', 'Water Charges', 'Maintenance Collection', 'Other Income'],
  Expense: ['Electricity', 'Staff Salaries', 'Equipment Repair', 'Spare Parts', 'Chemicals', 'Transportation', 'Operational Expenses', 'Other Expenses'],
});
const PAYMENT_METHODS = new Set(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other']);
const TEXT_LIMITS = Object.freeze({ title: 160, referenceNumber: 100, description: 3000, partyName: 140, notes: 2000 });

class FinanceServiceError extends Error {
  constructor(message) { super(message); this.name = 'FinanceServiceError'; }
}
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function localDateString(date = new Date()) {
  const local = new Date(date.getTime()); local.setMinutes(local.getMinutes() - local.getTimezoneOffset()); return local.toISOString().slice(0, 10);
}
function paiseFromRupees(value, label = 'Amount') {
  if (typeof value !== 'string' && typeof value !== 'number') throw new FinanceServiceError(`${label} must be a positive amount in rupees.`);
  const text = String(value).trim();
  if (!/^\d{1,12}(?:\.\d{0,2})?$/.test(text)) throw new FinanceServiceError(`${label} must be a positive amount with no more than two decimal places.`);
  const [rupees, fraction = ''] = text.split('.');
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new FinanceServiceError(`${label} must be greater than zero.`);
  return paise;
}
function cleanText(value, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new FinanceServiceError(`${field} must be text.`);
  const normalized = value.trim();
  const controls = ['description', 'notes'].includes(field) ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (normalized.length > TEXT_LIMITS[field] || controls.test(normalized)) throw new FinanceServiceError(`${field} contains invalid text or is too long.`);
  return normalized;
}
function normalizeTransaction(input) {
  if (!isRecord(input)) throw new FinanceServiceError('Enter transaction details before saving.');
  const allowed = new Set(['type', 'title', 'category', 'amount', 'date', 'paymentMethod', 'referenceNumber', 'description', 'relatedWorkOrderId', 'partyName', 'notes']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new FinanceServiceError(`Unsupported financial field: ${key}.`);
  const transaction = {
    type: input.type,
    title: cleanText(input.title, 'title'),
    category: input.category,
    amountPaise: paiseFromRupees(input.amount),
    date: input.date,
    paymentMethod: input.paymentMethod,
    referenceNumber: cleanText(input.referenceNumber, 'referenceNumber'),
    description: cleanText(input.description, 'description'),
    relatedWorkOrderId: input.relatedWorkOrderId ?? '',
    partyName: cleanText(input.partyName, 'partyName'),
    notes: cleanText(input.notes, 'notes'),
  };
  if (!Object.hasOwn(CATEGORIES, transaction.type)) throw new FinanceServiceError('Choose Income or Expense.');
  if (!transaction.title) throw new FinanceServiceError('Transaction title is required.');
  if (!CATEGORIES[transaction.type].includes(transaction.category)) throw new FinanceServiceError('Choose a valid category for this transaction type.');
  if (!validDate(transaction.date)) throw new FinanceServiceError('Enter a valid transaction date.');
  if (!PAYMENT_METHODS.has(transaction.paymentMethod)) throw new FinanceServiceError('Choose a valid payment method.');
  if (typeof transaction.relatedWorkOrderId !== 'string') throw new FinanceServiceError('Maintenance work order reference is invalid.');
  if (transaction.type === 'Income' && transaction.relatedWorkOrderId) throw new FinanceServiceError('Only expense transactions can link to a maintenance work order.');
  return transaction;
}
function validateStoredTransactions(rows) {
  if (!Array.isArray(rows)) throw new FinanceServiceError('The finance data file must contain a list of transactions.');
  const ids = new Set(); const codes = new Set();
  return rows.map((row) => {
    if (!isRecord(row) || typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.id) || typeof row.transactionCode !== 'string' || !row.transactionCode) throw new FinanceServiceError('A financial transaction has an invalid ID or code. No changes were saved.');
    if (ids.has(row.id) || codes.has(row.transactionCode)) throw new FinanceServiceError('Finance contains duplicate IDs or transaction codes. No changes were saved.');
    if (!Object.hasOwn(CATEGORIES, row.type) || !CATEGORIES[row.type].includes(row.category) || !Number.isSafeInteger(row.amountPaise) || row.amountPaise <= 0 || !validDate(row.date) || !PAYMENT_METHODS.has(row.paymentMethod) || !cleanText(row.title, 'title')) throw new FinanceServiceError('A financial transaction has invalid values. No changes were saved.');
    if (typeof row.createdAt !== 'string' || Number.isNaN(Date.parse(row.createdAt)) || typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt))) throw new FinanceServiceError('A financial transaction has invalid timestamps. No changes were saved.');
    const result = { ...row };
    for (const field of Object.keys(TEXT_LIMITS)) result[field] = cleanText(row[field], field);
    if (typeof result.relatedWorkOrderId !== 'string' || typeof result.relatedWorkOrderCode !== 'string') throw new FinanceServiceError('A maintenance reference is invalid. No changes were saved.');
    return result;
  });
}
function normalizeFilters(filters = {}) {
  if (!isRecord(filters)) throw new FinanceServiceError('Finance filters are invalid.');
  const allowed = new Set(['search', 'type', 'category', 'fromDate', 'toDate']);
  for (const key of Object.keys(filters)) if (!allowed.has(key)) throw new FinanceServiceError(`Unsupported finance filter: ${key}.`);
  if (filters.type && !Object.hasOwn(CATEGORIES, filters.type)) throw new FinanceServiceError('Choose a valid transaction type filter.');
  if (filters.category && !Object.values(CATEGORIES).flat().includes(filters.category)) throw new FinanceServiceError('Choose a valid finance category filter.');
  for (const key of ['search', 'type', 'category', 'fromDate', 'toDate']) if (filters[key] !== undefined && typeof filters[key] !== 'string') throw new FinanceServiceError(`${key} filter must be text.`);
  for (const key of ['fromDate', 'toDate']) if (filters[key] && !validDate(filters[key])) throw new FinanceServiceError('Finance date filter is invalid.');
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) throw new FinanceServiceError('Start date cannot be after end date.');
  if (filters.category && filters.type && !CATEGORIES[filters.type].includes(filters.category)) throw new FinanceServiceError('Category does not match the selected transaction type.');
  return filters;
}
function currentMonthParts(today) { const [year, month] = today.split('-').map(Number); return { year, month }; }
function monthKey(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }
function summarizeTransactions(records, today = localDateString()) {
  const { year: currentYear, month: currentMonth } = currentMonthParts(today);
  const totalIncomePaise = records.reduce((sum, row) => sum + (row.type === 'Income' ? row.amountPaise : 0), 0);
  const totalExpensesPaise = records.reduce((sum, row) => sum + (row.type === 'Expense' ? row.amountPaise : 0), 0);
  const currentMonthExpensesPaise = records.reduce((sum, row) => row.type === 'Expense' && row.date.slice(0, 7) === monthKey(currentYear, currentMonth) ? sum + row.amountPaise : sum, 0);
  if (![totalIncomePaise, totalExpensesPaise, currentMonthExpensesPaise].every(Number.isSafeInteger)) throw new FinanceServiceError('Finance totals exceed the safe calculation range.');
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(currentYear, currentMonth - 1 - offset, 1); const year = date.getFullYear(); const month = date.getMonth() + 1; const key = monthKey(year, month);
    const bucket = records.filter((row) => row.date.slice(0, 7) === key);
    months.push({ key, label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date), year, incomePaise: bucket.reduce((sum, row) => sum + (row.type === 'Income' ? row.amountPaise : 0), 0), expensePaise: bucket.reduce((sum, row) => sum + (row.type === 'Expense' ? row.amountPaise : 0), 0) });
  }
  const categoryTotals = new Map();
  records.filter((row) => row.type === 'Expense').forEach((row) => categoryTotals.set(row.category, (categoryTotals.get(row.category) || 0) + row.amountPaise));
  const recentTransactions = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  return { totalIncomePaise, totalExpensesPaise, netBalancePaise: totalIncomePaise - totalExpensesPaise, currentMonthExpensesPaise, monthlyTotals: months, expenseByCategory: [...categoryTotals].map(([category, amountPaise]) => ({ category, amountPaise })).sort((a, b) => b.amountPaise - a.amountPaise), recentTransactions };
}
function normalizeBudget(input) {
  if (!isRecord(input)) throw new FinanceServiceError('Enter budget details before saving.');
  for (const key of Object.keys(input)) if (!['category', 'month', 'year', 'budgetAmount'].includes(key)) throw new FinanceServiceError(`Unsupported budget field: ${key}.`);
  if (!CATEGORIES.Expense.includes(input.category)) throw new FinanceServiceError('Choose an expense category for this budget.');
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) throw new FinanceServiceError('Choose a valid budget month.');
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 9999) throw new FinanceServiceError('Enter a valid budget year.');
  return { category: input.category, month: input.month, year: input.year, budgetAmountPaise: paiseFromRupees(input.budgetAmount, 'Budget amount') };
}
function validateStoredBudgets(rows) {
  if (!Array.isArray(rows)) throw new FinanceServiceError('The budget data file must contain a list of budgets.');
  const ids = new Set(); const keys = new Set();
  return rows.map((row) => {
    if (!isRecord(row) || typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.id)) throw new FinanceServiceError('A budget has an invalid internal ID. No changes were saved.');
    const budget = normalizeBudget({ category: row.category, month: row.month, year: row.year, budgetAmount: `${Math.floor(row.budgetAmountPaise / 100)}.${String(row.budgetAmountPaise % 100).padStart(2, '0')}` });
    const key = `${budget.category}:${budget.year}:${budget.month}`;
    if (ids.has(row.id) || keys.has(key) || !Number.isSafeInteger(row.budgetAmountPaise) || row.budgetAmountPaise <= 0 || typeof row.createdAt !== 'string' || Number.isNaN(Date.parse(row.createdAt)) || typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt))) throw new FinanceServiceError('Finance contains invalid or duplicate budgets. No changes were saved.');
    ids.add(row.id); keys.add(key); return { ...budget, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
  });
}

function createFinanceService(dataDirectory, serialize = createOperationQueue()) {
  const readTransactions = async () => validateStoredTransactions(await readCollection(dataDirectory, 'finances'));
  const readBudgets = async () => validateStoredBudgets(await readCollection(dataDirectory, 'budgets'));
  const findWorkOrder = async (id) => {
    if (!id) return null;
    const records = await readCollection(dataDirectory, 'maintenance');
    if (!Array.isArray(records)) throw new FinanceServiceError('The maintenance data file is invalid.');
    const record = records.find((item) => item?.id === id);
    if (!record) throw new FinanceServiceError('The selected maintenance work order does not exist.');
    return record;
  };
  const generateCode = (rows) => {
    const prefix = `FIN-${localDateString().replaceAll('-', '')}-`;
    const seq = rows.filter((row) => row.transactionCode.startsWith(prefix)).map((row) => Number(row.transactionCode.slice(prefix.length))).filter(Number.isSafeInteger);
    return `${prefix}${String(Math.max(0, ...seq) + 1).padStart(4, '0')}`;
  };
  const enrichBudgets = (budgets, transactions) => budgets.map((budget) => {
    const actualSpentPaise = transactions.reduce((sum, row) => row.type === 'Expense' && row.category === budget.category && row.date.slice(0, 7) === monthKey(budget.year, budget.month) ? sum + row.amountPaise : sum, 0);
    if (!Number.isSafeInteger(actualSpentPaise)) throw new FinanceServiceError('Budget totals exceed the safe calculation range.');
    return { ...budget, actualSpentPaise, remainingPaise: budget.budgetAmountPaise - actualSpentPaise, exceeded: actualSpentPaise > budget.budgetAmountPaise };
  });
  return {
    listTransactions(filters = {}) { return serialize(async () => {
      const selected = normalizeFilters(filters); const rows = await readTransactions(); const query = (selected.search || '').trim().toLocaleLowerCase();
      return rows.filter((row) => (!selected.type || row.type === selected.type) && (!selected.category || row.category === selected.category) && (!selected.fromDate || row.date >= selected.fromDate) && (!selected.toDate || row.date <= selected.toDate) && (!query || [row.transactionCode, row.title, row.category, row.partyName, row.referenceNumber, row.relatedWorkOrderCode].some((value) => value?.toLocaleLowerCase().includes(query)))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }); },
    getTransaction(id) { return serialize(async () => { const transaction = (await readTransactions()).find((row) => row.id === id); if (!transaction) throw new FinanceServiceError('Financial transaction not found.'); return transaction; }); },
    createTransaction(input) { return serialize(async () => {
      const transaction = normalizeTransaction(input); const rows = await readTransactions(); let relatedWorkOrderCode = '';
      if (transaction.relatedWorkOrderId) { const record = await findWorkOrder(transaction.relatedWorkOrderId); relatedWorkOrderCode = record.workOrderCode; }
      const now = new Date().toISOString(); const created = { ...transaction, id: randomUUID(), transactionCode: generateCode(rows), relatedWorkOrderCode, createdAt: now, updatedAt: now };
      await writeCollection(dataDirectory, 'finances', [...rows, created]); return created;
    }); },
    updateTransaction(id, input) { return serialize(async () => {
      const rows = await readTransactions(); const index = rows.findIndex((row) => row.id === id); if (index < 0) throw new FinanceServiceError('Financial transaction not found.');
      const transaction = normalizeTransaction(input); let relatedWorkOrderCode = rows[index].relatedWorkOrderCode;
      if (transaction.relatedWorkOrderId !== rows[index].relatedWorkOrderId) relatedWorkOrderCode = transaction.relatedWorkOrderId ? (await findWorkOrder(transaction.relatedWorkOrderId)).workOrderCode : '';
      const updated = { ...transaction, id, transactionCode: rows[index].transactionCode, relatedWorkOrderCode, createdAt: rows[index].createdAt, updatedAt: new Date(Math.max(Date.now(), Date.parse(rows[index].updatedAt) + 1)).toISOString() };
      const next = [...rows]; next[index] = updated; await writeCollection(dataDirectory, 'finances', next); return updated;
    }); },
    deleteTransaction(id) { return serialize(async () => { const rows = await readTransactions(); const transaction = rows.find((row) => row.id === id); if (!transaction) throw new FinanceServiceError('Financial transaction not found.'); await writeCollection(dataDirectory, 'finances', rows.filter((row) => row.id !== id)); return { id, transactionCode: transaction.transactionCode, title: transaction.title }; }); },
    getSummary() { return serialize(async () => summarizeTransactions(await readTransactions(), localDateString())); },
    listBudgets() { return serialize(async () => enrichBudgets(await readBudgets(), await readTransactions()).sort((a, b) => b.year - a.year || b.month - a.month || a.category.localeCompare(b.category))); },
    createBudget(input) { return serialize(async () => { const budget = normalizeBudget(input); const rows = await readBudgets(); if (rows.some((row) => row.category === budget.category && row.month === budget.month && row.year === budget.year)) throw new FinanceServiceError('A budget already exists for this category and month.'); const now = new Date().toISOString(); const created = { ...budget, id: randomUUID(), createdAt: now, updatedAt: now }; await writeCollection(dataDirectory, 'budgets', [...rows, created]); return enrichBudgets([created], await readTransactions())[0]; }); },
    updateBudget(id, input) { return serialize(async () => { const budget = normalizeBudget(input); const rows = await readBudgets(); const index = rows.findIndex((row) => row.id === id); if (index < 0) throw new FinanceServiceError('Budget not found.'); if (rows.some((row) => row.id !== id && row.category === budget.category && row.month === budget.month && row.year === budget.year)) throw new FinanceServiceError('A budget already exists for this category and month.'); const updated = { ...budget, id, createdAt: rows[index].createdAt, updatedAt: new Date(Math.max(Date.now(), Date.parse(rows[index].updatedAt) + 1)).toISOString() }; const next = [...rows]; next[index] = updated; await writeCollection(dataDirectory, 'budgets', next); return enrichBudgets([updated], await readTransactions())[0]; }); },
    deleteBudget(id) { return serialize(async () => { const rows = await readBudgets(); const budget = rows.find((row) => row.id === id); if (!budget) throw new FinanceServiceError('Budget not found.'); await writeCollection(dataDirectory, 'budgets', rows.filter((row) => row.id !== id)); return { id, category: budget.category, month: budget.month, year: budget.year }; }); },
  };
}

module.exports = { FinanceServiceError, CATEGORIES, PAYMENT_METHODS: [...PAYMENT_METHODS], createFinanceService, localDateString, paiseFromRupees, summarizeTransactions };
