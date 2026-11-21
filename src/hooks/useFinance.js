import { useCallback, useEffect, useState } from 'react';

export default function useFinance() {
  const [transactions, setTransactions] = useState([]); const [summary, setSummary] = useState(null); const [budgets, setBudgets] = useState([]); const [maintenanceOrders, setMaintenanceOrders] = useState([]); const [maintenanceOrdersError, setMaintenanceOrdersError] = useState(''); const [state, setState] = useState('loading'); const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setState('loading'); setError('');
    if (!window.smartWater?.listFinancialTransactions) { setState('error'); setError('Finance records are available in the SmartWater desktop application.'); return false; }
    try {
      const [tx, financeSummary, budgetList] = await Promise.all([window.smartWater.listFinancialTransactions({}), window.smartWater.getFinanceSummary(), window.smartWater.listBudgets()]);
      if (!tx?.ok || !Array.isArray(tx.data) || !financeSummary?.ok || !budgetList?.ok) throw new Error(tx?.error || financeSummary?.error || budgetList?.error || 'Could not load finance data.');
      setTransactions(tx.data); setSummary(financeSummary.data); setBudgets(budgetList.data);
      try { const workOrders = await window.smartWater.listFinanceMaintenanceOrders(); if (workOrders?.ok && Array.isArray(workOrders.data)) { setMaintenanceOrders(workOrders.data); setMaintenanceOrdersError(''); } else { setMaintenanceOrders([]); setMaintenanceOrdersError('Maintenance work orders could not be loaded. Expenses can still be recorded without a link.'); } }
      catch { setMaintenanceOrders([]); setMaintenanceOrdersError('Maintenance work orders could not be loaded. Expenses can still be recorded without a link.'); }
      setState('ready'); return true;
    } catch { setState('error'); setError('Could not load finance data. Please try again.'); return false; }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { transactions, setTransactions, summary, setSummary, budgets, setBudgets, maintenanceOrders, maintenanceOrdersError, state, error, reload };
}
