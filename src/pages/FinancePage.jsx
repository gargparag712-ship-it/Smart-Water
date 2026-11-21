import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, CircleDollarSign, Eye, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, TrendingUp, X } from 'lucide-react';
import useFinance from '../hooks/useFinance.js';
import { expenseCategories, incomeCategories, monthOptions } from '../data/financeOptions.js';
import { budgetProgress, filterTransactions, formatPaise } from '../utils/finance.js';
import FinancialTransactionDialog from '../components/finance/FinancialTransactionDialog.jsx';
import FinancialTransactionDetails from '../components/finance/FinancialTransactionDetails.jsx';
import BudgetDialog from '../components/finance/BudgetDialog.jsx';
import FinanceCharts from '../components/finance/FinanceCharts.jsx';

const emptyFilters = { search: '', type: '', category: '', fromDate: '', toDate: '' };
const currentMonthValues = () => { const now = new Date(); return { month: now.getMonth() + 1, year: now.getFullYear() }; };
function dateLabel(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function FinancePage() {
  const { transactions, setTransactions, summary, setSummary, budgets, setBudgets, maintenanceOrders, maintenanceOrdersError, state, error, reload } = useFinance();
  const [filters, setFilters] = useState(emptyFilters); const [transactionForm, setTransactionForm] = useState(undefined); const [details, setDetails] = useState(null); const [deleteTransaction, setDeleteTransaction] = useState(null); const [budgetForm, setBudgetForm] = useState(undefined); const [deleteBudget, setDeleteBudget] = useState(null);
  const [budgetMonth, setBudgetMonth] = useState(currentMonthValues); const [busy, setBusy] = useState(false); const [dialogError, setDialogError] = useState(''); const [feedback, setFeedback] = useState('');
  const visible = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const transactionCategories = filters.type === 'Income' ? incomeCategories : filters.type === 'Expense' ? expenseCategories : [...incomeCategories, ...expenseCategories];
  const monthBudgets = budgets.filter((budget) => budget.month === budgetMonth.month && budget.year === budgetMonth.year);
  const monthLabel = `${monthOptions[budgetMonth.month - 1].label} ${budgetMonth.year}`;

  async function refreshCalculated() {
    try {
      const [summaryResult, budgetResult] = await Promise.all([window.smartWater.getFinanceSummary(), window.smartWater.listBudgets()]);
      if (summaryResult?.ok) setSummary(summaryResult.data);
      if (budgetResult?.ok) setBudgets(budgetResult.data);
    } catch { /* The saved transaction remains successful if refreshing summaries is temporarily unavailable. */ }
  }
  async function saveTransaction(fields) {
    setBusy(true); setDialogError('');
    try {
      const result = transactionForm?.id ? await window.smartWater.updateFinancialTransaction(transactionForm.id, fields) : await window.smartWater.createFinancialTransaction(fields);
      if (!result?.ok) { setDialogError(result?.error || 'Could not save this transaction.'); return; }
      setTransactions((old) => (transactionForm ? old.map((row) => row.id === result.data.id ? result.data : row) : [...old, result.data]).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      await refreshCalculated(); setTransactionForm(undefined); setFeedback(transactionForm?.id ? `${result.data.transactionCode} updated.` : `${result.data.transactionCode} recorded.`);
    } catch { setDialogError('Could not save this transaction. Please try again.'); } finally { setBusy(false); }
  }
  async function confirmDeleteTransaction() {
    setBusy(true); setDialogError('');
    try { const result = await window.smartWater.deleteFinancialTransaction(deleteTransaction.id); if (!result?.ok) { setDialogError(result?.error || 'Could not delete this transaction.'); return; } setTransactions((old) => old.filter((row) => row.id !== deleteTransaction.id)); await refreshCalculated(); setDeleteTransaction(null); setFeedback(`${result.data.transactionCode} deleted.`); }
    catch { setDialogError('Could not delete this transaction. Please try again.'); } finally { setBusy(false); }
  }
  async function saveBudget(fields) {
    setBusy(true); setDialogError('');
    try { const result = budgetForm ? await window.smartWater.updateBudget(budgetForm.id, fields) : await window.smartWater.createBudget(fields); if (!result?.ok) { setDialogError(result?.error || 'Could not save budget.'); return; } setBudgets((old) => (budgetForm ? old.map((row) => row.id === result.data.id ? result.data : row) : [...old, result.data])); setBudgetForm(undefined); setFeedback(budgetForm ? 'Budget updated.' : 'Monthly budget set.'); }
    catch { setDialogError('Could not save budget. Please try again.'); } finally { setBusy(false); }
  }
  async function confirmDeleteBudget() {
    setBusy(true); setDialogError('');
    try { const result = await window.smartWater.deleteBudget(deleteBudget.id); if (!result?.ok) { setDialogError(result?.error || 'Could not delete budget.'); return; } setBudgets((old) => old.filter((row) => row.id !== deleteBudget.id)); setDeleteBudget(null); setFeedback('Monthly budget deleted.'); }
    catch { setDialogError('Could not delete budget. Please try again.'); } finally { setBusy(false); }
  }
  function setFilter(name, value) { setFilters((old) => ({ ...old, [name]: value, ...(name === 'type' ? { category: '' } : {}) })); }
  const stats = [
    { label: 'Total income', value: summary?.totalIncomePaise ?? 0, icon: ArrowDownRight, tone: 'income' },
    { label: 'Total expenses', value: summary?.totalExpensesPaise ?? 0, icon: ArrowUpRight, tone: 'expense' },
    { label: 'Net balance', value: summary?.netBalancePaise ?? 0, icon: TrendingUp, tone: 'balance' },
    { label: 'Current month expenses', value: summary?.currentMonthExpensesPaise ?? 0, icon: CalendarDays, tone: 'month' },
  ];
  return <div className="finance-page">
    <div className="finance-intro"><div><p>Track scheme income, operating costs and monthly category budgets.</p><span><CheckCircle2 size={14} /> Saved locally · INR transactions</span></div><div className="finance-intro-actions"><button className="button-secondary income-action" type="button" disabled={state !== 'ready'} onClick={() => { setDialogError(''); setTransactionForm({ type: 'Income' }); }}><Plus size={15} /> Add Income</button><button className="button-primary" type="button" disabled={state !== 'ready'} onClick={() => { setDialogError(''); setTransactionForm({ type: 'Expense' }); }}><Plus size={15} /> Add Expense</button></div></div>
    {feedback && <div className="asset-feedback success" role="status"><CheckCircle2 size={16} />{feedback}<button type="button" aria-label="Dismiss" onClick={() => setFeedback('')}><X size={15} /></button></div>}
    {dialogError && transactionForm === undefined && budgetForm === undefined && !deleteTransaction && !deleteBudget && <div className="asset-feedback error" role="alert"><CircleAlert size={16} />{dialogError}<button type="button" aria-label="Dismiss error" onClick={() => setDialogError('')}><X size={15} /></button></div>}
    {state === 'error' && <div className="asset-state-panel error-state"><CircleAlert size={23} /><strong>Finance records unavailable</strong><span>{error}</span><button className="button-secondary" type="button" onClick={reload}><RefreshCw size={14} /> Try again</button></div>}
    <section className="finance-stats" aria-label="Finance summary">{stats.map(({ label, value, icon: Icon, tone }) => <article className={`finance-stat tone-${tone}`} key={label}><span><Icon size={17} /></span><small>{label}</small><strong>{state === 'ready' ? formatPaise(value, { compact: true }) : '—'}</strong><i>LIVE</i></article>)}</section>

    <FinanceCharts summary={state === 'ready' ? summary : null} />

    <section className="panel finance-register"><header className="finance-section-heading"><div><span className="asset-section-eyebrow">INCOME & EXPENSES</span><h2>Financial transactions</h2><p>Every saved transaction is included in the finance summaries.</p></div><span className="live-records-tag"><i /> LIVE RECORDS</span></header>
      <div className="finance-toolbar"><label className="finance-search"><Search size={16} /><input aria-label="Search financial transactions" placeholder="Search title, reference, party or code…" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} /></label><select aria-label="Filter transaction type" value={filters.type} onChange={(event) => setFilter('type', event.target.value)}><option value="">Income & expenses</option><option>Income</option><option>Expense</option></select><select aria-label="Filter transaction category" value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="">All categories</option>{transactionCategories.map((category) => <option key={category}>{category}</option>)}</select><label className="finance-date-filter">From<input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></label><label className="finance-date-filter">To<input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></label><span className="finance-result-count">{visible.length} of {transactions.length}</span></div>
      {state === 'loading' && <div className="asset-state-panel"><RefreshCw size={22} className="state-spinner" /><strong>Loading finance records</strong><span>Reading locally saved transactions and budgets…</span></div>}
      {state === 'ready' && !transactions.length && <div className="asset-state-panel"><span className="asset-empty-icon"><CircleDollarSign size={19} /></span><strong>No financial transactions yet</strong><span>Record actual income or expenses to see totals, cash flow and category summaries.</span><div className="finance-empty-actions"><button className="button-secondary income-action" type="button" onClick={() => setTransactionForm({ type: 'Income' })}>Add Income</button><button className="button-primary" type="button" onClick={() => setTransactionForm({ type: 'Expense' })}>Add Expense</button></div></div>}
      {state === 'ready' && transactions.length > 0 && !visible.length && <div className="asset-state-panel"><strong>No matching transactions</strong><span>Change the search or filters to see more records.</span><button className="button-secondary" type="button" onClick={() => setFilters({ ...emptyFilters })}>Clear filters</button></div>}
      {state === 'ready' && visible.length > 0 && <div className="asset-table-scroll"><table className="asset-table finance-table"><thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Party / reference</th><th>Payment</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((transaction) => <tr key={transaction.id}><td>{dateLabel(transaction.date)}</td><td><div className="table-asset"><span className={`finance-type-icon ${transaction.type.toLowerCase()}`}>{transaction.type === 'Income' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}</span><span><strong>{transaction.title}</strong><small>{transaction.type} · {transaction.transactionCode}{transaction.relatedWorkOrderCode ? ` · ${transaction.relatedWorkOrderCode}` : ''}</small></span></div></td><td>{transaction.category}</td><td><div className="scheme-cell"><strong>{transaction.partyName || '—'}</strong><small>{transaction.referenceNumber || 'No reference'}</small></div></td><td>{transaction.paymentMethod}</td><td><strong className={`finance-amount ${transaction.type.toLowerCase()}`}>{transaction.type === 'Income' ? '+' : '−'}{formatPaise(transaction.amountPaise)}</strong></td><td><div className="row-actions"><button type="button" aria-label={`View ${transaction.transactionCode}`} onClick={() => setDetails(transaction)}><Eye size={15} /></button><button type="button" aria-label={`Edit ${transaction.transactionCode}`} onClick={() => { setDialogError(''); setTransactionForm(transaction); }}><Pencil size={14} /></button><button className="delete-action" type="button" aria-label={`Delete ${transaction.transactionCode}`} onClick={() => { setDialogError(''); setDeleteTransaction(transaction); }}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>}
      {state === 'ready' && <footer className="directory-footer"><span>Transaction references are generated automatically. Amounts are stored in integer paise.</span><span>{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}</span></footer>}
    </section>

    <section className="panel finance-budgets"><header className="finance-section-heading"><div><span className="asset-section-eyebrow">SPENDING LIMITS</span><h2>Monthly expense budgets</h2><p>Compare actual category expenses with simple monthly budgets.</p></div><button className="button-primary" type="button" disabled={state !== 'ready'} onClick={() => { setDialogError(''); setBudgetForm(null); }}><Plus size={15} /> Set budget</button></header>
      <div className="finance-budget-toolbar"><label><CalendarDays size={14} /><select aria-label="Budget month" value={budgetMonth.month} onChange={(event) => setBudgetMonth((old) => ({ ...old, month: Number(event.target.value) }))}>{monthOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><input aria-label="Budget year" type="number" min="2000" max="9999" value={budgetMonth.year} onChange={(event) => setBudgetMonth((old) => ({ ...old, year: Number(event.target.value) }))} /></label><span>Budget status for {monthLabel}</span></div>
      {state === 'ready' && !monthBudgets.length && <div className="finance-budget-empty">No category budgets for {monthLabel}. Set one to track actual spend against a planned limit.</div>}
      {state === 'ready' && monthBudgets.length > 0 && <div className="budget-grid">{monthBudgets.map((budget) => { const progress = budgetProgress(budget); return <article className={`budget-card${progress.exceeded ? ' exceeded' : ''}`} key={budget.id}><div className="budget-card-heading"><div><strong>{budget.category}</strong><span>{monthLabel}</span></div><div className="row-actions"><button type="button" aria-label={`Edit ${budget.category} budget`} onClick={() => { setDialogError(''); setBudgetForm(budget); }}><Pencil size={14} /></button><button className="delete-action" type="button" aria-label={`Delete ${budget.category} budget`} onClick={() => { setDialogError(''); setDeleteBudget(budget); }}><Trash2 size={14} /></button></div></div><div className="budget-amount-row"><span>Spent <strong>{formatPaise(budget.actualSpentPaise)}</strong></span><span>Budget <strong>{formatPaise(budget.budgetAmountPaise)}</strong></span></div><div className="budget-progress-track"><span style={{ width: `${progress.percent}%` }} /></div><div className="budget-remaining-row">{progress.exceeded ? <span className="budget-warning"><ShieldAlert size={13} /> Exceeded by {formatPaise(-progress.remainingPaise)}</span> : <span>Remaining <strong>{formatPaise(progress.remainingPaise)}</strong></span>}<span>{progress.percent}% used</span></div></article>; })}</div>}
      {state === 'ready' && <footer className="directory-footer"><span>Budgets apply to one expense category and calendar month.</span><span>{budgets.length} total budgets</span></footer>}
    </section>

    {transactionForm !== undefined && <FinancialTransactionDialog key={transactionForm?.id ?? `new-${transactionForm?.type}`} transaction={transactionForm?.id ? transactionForm : null} initialType={transactionForm?.type} maintenanceOrders={maintenanceOrders} maintenanceOrdersError={maintenanceOrdersError} busy={busy} error={dialogError} onClose={() => !busy && setTransactionForm(undefined)} onSave={saveTransaction} />}
    {details && <FinancialTransactionDetails transaction={details} onClose={() => setDetails(null)} onEdit={(transaction) => { setDetails(null); setTransactionForm(transaction); setDialogError(''); }} />}
    {budgetForm !== undefined && <BudgetDialog key={budgetForm?.id ?? 'new-budget'} budget={budgetForm} month={budgetMonth.month} year={budgetMonth.year} busy={busy} error={dialogError} onClose={() => !busy && setBudgetForm(undefined)} onSave={saveBudget} />}
    {deleteTransaction && <div className="dialog-backdrop" role="presentation"><section className="asset-dialog delete-dialog" role="alertdialog" aria-modal="true"><span className="delete-dialog-icon"><Trash2 size={21} /></span><h2>Delete this transaction?</h2><p>Remove <strong>{deleteTransaction.transactionCode}</strong> · {deleteTransaction.title} ({formatPaise(deleteTransaction.amountPaise)}) from your finance records. Totals will update after deletion.</p>{dialogError && <div className="form-feedback error" role="alert">{dialogError}</div>}<footer className="delete-dialog-actions"><button className="button-secondary" type="button" disabled={busy} onClick={() => setDeleteTransaction(null)}>Keep transaction</button><button className="button-danger" type="button" disabled={busy} onClick={confirmDeleteTransaction}>{busy ? 'Deleting…' : 'Delete transaction'}</button></footer></section></div>}
    {deleteBudget && <div className="dialog-backdrop" role="presentation"><section className="asset-dialog delete-dialog" role="alertdialog" aria-modal="true"><span className="delete-dialog-icon"><Trash2 size={21} /></span><h2>Delete this budget?</h2><p>Remove the {deleteBudget.category} budget for {monthOptions[deleteBudget.month - 1].label} {deleteBudget.year}.</p>{dialogError && <div className="form-feedback error" role="alert">{dialogError}</div>}<footer className="delete-dialog-actions"><button className="button-secondary" type="button" disabled={busy} onClick={() => setDeleteBudget(null)}>Keep budget</button><button className="button-danger" type="button" disabled={busy} onClick={confirmDeleteBudget}>{busy ? 'Deleting…' : 'Delete budget'}</button></footer></section></div>}
  </div>;
}
