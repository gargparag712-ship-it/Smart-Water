export function formatPaise(paise = 0, { compact = false } = {}) {
  const amount = paise / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 2, minimumFractionDigits: compact ? 0 : 2 }).format(amount);
}

export function summarizeTransactions(records) {
  const income = records.reduce((sum, row) => sum + (row.type === 'Income' ? row.amountPaise : 0), 0);
  const expenses = records.reduce((sum, row) => sum + (row.type === 'Expense' ? row.amountPaise : 0), 0);
  const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonthExpenses = records.reduce((sum, row) => row.type === 'Expense' && row.date.slice(0, 7) === `${year}-${month}` ? sum + row.amountPaise : sum, 0);
  return { totalIncomePaise: income, totalExpensesPaise: expenses, netBalancePaise: income - expenses, currentMonthExpensesPaise: currentMonthExpenses };
}

export function filterTransactions(records, filters = {}) {
  const query = filters.search?.trim().toLocaleLowerCase() ?? '';
  return records.filter((row) => (!filters.type || row.type === filters.type) && (!filters.category || row.category === filters.category)
    && (!filters.fromDate || row.date >= filters.fromDate) && (!filters.toDate || row.date <= filters.toDate)
    && (!query || [row.transactionCode, row.title, row.category, row.partyName, row.referenceNumber, row.relatedWorkOrderCode].some((value) => value?.toLocaleLowerCase().includes(query))));
}

export function budgetProgress(budget) {
  const remainingPaise = budget.budgetAmountPaise - budget.actualSpentPaise;
  return { remainingPaise, exceeded: budget.actualSpentPaise > budget.budgetAmountPaise, percent: budget.budgetAmountPaise ? Math.min(100, Math.round((budget.actualSpentPaise / budget.budgetAmountPaise) * 100)) : 0 };
}
