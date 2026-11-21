const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { createAssetService } = require('../electron/assetsService.cjs');
const { createFinanceService, localDateString, summarizeTransactions } = require('../electron/financeService.cjs');
const { createMaintenanceService } = require('../electron/maintenanceService.cjs');
const { createOperationQueue } = require('../electron/operationQueue.cjs');
const { ensureStorage } = require('../electron/storage.cjs');

let directory; let finance; let assets; let maintenance; let asset;
const date = localDateString();
const income = (extra = {}) => ({ type: 'Income', title: 'November water charges', category: 'Water Charges', amount: '1250.25', date, paymentMethod: 'UPI', referenceNumber: 'UTR-100', description: 'Collected fees', partyName: 'Residents', notes: 'Batch 1', ...extra });
const expense = (extra = {}) => ({ type: 'Expense', title: 'Pump electricity', category: 'Electricity', amount: '450.50', date, paymentMethod: 'Bank Transfer', referenceNumber: 'TX-900', partyName: 'Power Board', description: '', notes: '', ...extra });
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartwater-finance-')); await ensureStorage(directory);
  const queue = createOperationQueue(); assets = createAssetService(directory, queue); maintenance = createMaintenanceService(directory, queue); finance = createFinanceService(directory, queue);
  asset = await assets.createAsset({ assetCode: 'PMP-1', name: 'Borewell Pump', category: 'Pump' });
});
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));

test('creates Income and Expense transactions with unique codes and integer paise', async () => {
  const [received, paid] = await Promise.all([finance.createTransaction(income()), finance.createTransaction(expense())]);
  assert.match(received.transactionCode, /^FIN-\d{8}-\d{4}$/); assert.notEqual(received.transactionCode, paid.transactionCode);
  assert.equal(received.amountPaise, 125025); assert.equal(paid.amountPaise, 45050); assert.equal((await finance.listTransactions()).length, 2);
});
test('edits and deletes transactions safely', async () => {
  const row = await finance.createTransaction(income()); const edited = await finance.updateTransaction(row.id, income({ title: 'Water tariff collection', amount: '1500.00' }));
  assert.equal(edited.transactionCode, row.transactionCode); assert.equal(edited.amountPaise, 150000); assert.ok(Date.parse(edited.updatedAt) >= Date.parse(row.updatedAt));
  assert.deepEqual(await finance.deleteTransaction(row.id), { id: row.id, transactionCode: row.transactionCode, title: 'Water tariff collection' }); assert.deepEqual(await finance.listTransactions(), []);
});
test('rejects invalid amounts, categories, methods, dates and renderer-owned fields', async () => {
  for (const amount of ['0', '-1', '1.999', 'abc', '1000000000000']) await assert.rejects(finance.createTransaction(income({ amount })), /amount/i);
  await assert.rejects(finance.createTransaction(income({ category: 'Electricity' })), /valid category/);
  await assert.rejects(finance.createTransaction(income({ paymentMethod: 'Crypto' })), /payment method/);
  await assert.rejects(finance.createTransaction(income({ date: '2026-02-30' })), /valid transaction date/);
  await assert.rejects(finance.createTransaction({ ...income(), transactionCode: 'FIN-MANUAL' }), /Unsupported financial field/);
});
test('calculates income, expenses, net balance and current month expense in paise', async () => {
  await finance.createTransaction(income()); await finance.createTransaction(expense()); await finance.createTransaction(expense({ title: 'Valve repair parts', category: 'Spare Parts', amount: '100.25' }));
  const summary = await finance.getSummary(); assert.equal(summary.totalIncomePaise, 125025); assert.equal(summary.totalExpensesPaise, 55075); assert.equal(summary.netBalancePaise, 69950); assert.equal(summary.currentMonthExpensesPaise, 55075);
  assert.equal(summary.monthlyTotals.length, 12); assert.equal(summary.monthlyTotals.at(-1).expensePaise, 55075); assert.equal(summary.expenseByCategory.length, 2);
});
test('date range, type and category filters compose', async () => {
  await finance.createTransaction(income()); await finance.createTransaction(expense());
  const rows = await finance.listTransactions({ type: 'Expense', category: 'Electricity', fromDate: date, toDate: date, search: 'power board' }); assert.equal(rows.length, 1); assert.equal(rows[0].type, 'Expense');
  await assert.rejects(finance.listTransactions({ type: 'Income', category: 'Chemicals' }), /does not match/);
});
test('creates, edits budgets and calculates actual spend and exceeded amounts', async () => {
  const [year, month] = date.split('-').map(Number);
  await finance.createTransaction(expense({ amount: '125.50' }));
  const budget = await finance.createBudget({ category: 'Electricity', month, year, budgetAmount: '100.00' });
  assert.equal(budget.actualSpentPaise, 12550); assert.equal(budget.remainingPaise, -2550); assert.equal(budget.exceeded, true);
  await assert.rejects(finance.createBudget({ category: 'Electricity', month, year, budgetAmount: '200' }), /already exists/);
  const updated = await finance.updateBudget(budget.id, { category: 'Electricity', month, year, budgetAmount: '200.00' }); assert.equal(updated.budgetAmountPaise, 20000); assert.equal(updated.exceeded, false);
  await assert.rejects(finance.updateBudget(budget.id, { category: 'Spare Parts', month, year, budgetAmount: '0' }), /greater than zero/);
  assert.deepEqual(await finance.deleteBudget(budget.id), { id: budget.id, category: 'Electricity', month, year });
});
test('validates optional maintenance references and stores the work order snapshot', async () => {
  const order = await maintenance.createRecord({ assetId: asset.id, maintenanceType: 'Corrective', title: 'Bearing repair', description: '', priority: 'High', scheduledDate: date, assignedTo: '', remarks: '' });
  const linked = await finance.createTransaction(expense({ relatedWorkOrderId: order.id })); assert.equal(linked.relatedWorkOrderCode, order.workOrderCode);
  await assert.rejects(finance.createTransaction(expense({ relatedWorkOrderId: 'missing-work-order' })), /does not exist/);
  await assert.rejects(finance.createTransaction(income({ relatedWorkOrderId: order.id })), /Only expense/);
  const changed = await finance.updateTransaction(linked.id, expense({ title: 'Updated repair expense', relatedWorkOrderId: order.id })); assert.equal(changed.relatedWorkOrderCode, order.workOrderCode);
  await require('../electron/storage.cjs').writeCollection(directory, 'maintenance', []);
  assert.equal((await finance.getTransaction(linked.id)).relatedWorkOrderCode, order.workOrderCode);
  const preserved = await finance.updateTransaction(linked.id, expense({ title: 'Linked work order archived', relatedWorkOrderId: order.id })); assert.equal(preserved.relatedWorkOrderCode, order.workOrderCode);
});
test('preserves transactions and budgets after finance service recreation', async () => {
  const row = await finance.createTransaction(income()); const [year, month] = date.split('-').map(Number); const budget = await finance.createBudget({ category: 'Electricity', month, year, budgetAmount: '50' });
  finance = createFinanceService(directory, createOperationQueue()); assert.deepEqual(await finance.getTransaction(row.id), row); assert.equal((await finance.listBudgets())[0].id, budget.id);
});
test('summary calculation handles empty records and calendar month boundaries', () => {
  assert.equal(summarizeTransactions([], '2026-01-05').netBalancePaise, 0);
  const rows = [{ type: 'Expense', amountPaise: 200, date: '2025-12-31', createdAt: date }, { type: 'Expense', amountPaise: 100, date: '2026-01-01', createdAt: date }];
  assert.equal(summarizeTransactions(rows, '2026-01-05').currentMonthExpensesPaise, 100);
});
