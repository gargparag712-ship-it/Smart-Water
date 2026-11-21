import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import { formatPaise } from '../utils/finance.js';
const metrics = [
  { key: 'totalIncomePaise', label: 'Total income', icon: ArrowDownRight, tone: 'income' },
  { key: 'totalExpensesPaise', label: 'Total expenses', icon: ArrowUpRight, tone: 'expense' },
  { key: 'netBalancePaise', label: 'Net balance', icon: TrendingUp, tone: 'balance' },
];
export default function FinanceOverview({ summary, state }) {
  return <section className="finance-overview-strip" aria-label="Finance overview"><div className="finance-overview-title"><strong>Finance overview</strong><span>{state === 'ready' ? 'LIVE LOCAL RECORDS' : state === 'loading' ? 'LOADING' : 'UNAVAILABLE'}</span></div>{metrics.map(({ key, label, icon: Icon, tone }) => <div className={`finance-overview-metric ${tone}`} key={key}><Icon size={15} /><span>{label}</span><strong>{state === 'ready' ? formatPaise(summary[key], { compact: true }) : '—'}</strong></div>)}</section>;
}
