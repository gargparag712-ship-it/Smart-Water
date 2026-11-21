import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PanelHeading from '../PanelHeading.jsx';
import { formatPaise } from '../../utils/finance.js';

function MonthlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((entry) => <span key={entry.dataKey}>{entry.name} <b>{formatPaise(entry.value)}</b></span>)}</div>;
}
function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{payload[0].name}</strong><span>{formatPaise(payload[0].value)}</span></div>;
}
const COLORS = ['#238b79', '#56aa92', '#e1a843', '#748bad', '#d47c6e', '#9b83b2', '#67a7b7', '#a6a38a'];
export default function FinanceCharts({ summary }) {
  const months = (summary?.monthlyTotals ?? []).map((row) => ({ ...row, income: row.incomePaise / 100, expenses: row.expensePaise / 100 }));
  const categories = (summary?.expenseByCategory ?? []).map((row) => ({ ...row, value: row.amountPaise / 100 }));
  return <div className="finance-charts-grid">
    <section className="panel finance-chart-panel"><PanelHeading eyebrow="CASH FLOW" title="Income vs expenses" subtitle="Calendar month totals from saved transactions" action={<span className="chart-unit">INR · LIVE</span>} />
      {months.some((row) => row.income || row.expenses) ? <div className="finance-chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{ top: 10, right: 8, bottom: 0, left: -12 }} barCategoryGap="25%"><CartesianGrid vertical={false} stroke="#edf1f0" strokeDasharray="3 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8a9a97', fontSize: 9 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a9a97', fontSize: 9 }} tickFormatter={(value) => value >= 100000 ? `₹${(value / 100000).toFixed(0)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`} /><Tooltip content={<MonthlyTooltip />} /><Bar dataKey="income" name="Income" fill="#31a181" radius={[3, 3, 0, 0]} maxBarSize={18} /><Bar dataKey="expenses" name="Expenses" fill="#e2a64c" radius={[3, 3, 0, 0]} maxBarSize={18} /></BarChart></ResponsiveContainer></div> : <div className="finance-chart-empty">Add transactions to see monthly cash flow.</div>}
      <div className="finance-chart-legend"><span><i className="income-dot" /> Income</span><span><i className="expense-dot" /> Expenses</span></div>
    </section>
    <section className="panel finance-chart-panel"><PanelHeading eyebrow="SPENDING MIX" title="Expense categories" subtitle="All saved expense transactions" action={<span className="chart-unit">INR · LIVE</span>} />
      {categories.length ? <div className="finance-category-chart"><div className="finance-pie-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="category" innerRadius={52} outerRadius={76} paddingAngle={2} stroke="none">{categories.map((row, index) => <Cell key={row.category} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip content={<CategoryTooltip />} /></PieChart></ResponsiveContainer></div><div className="finance-category-legend">{categories.slice(0, 6).map((row, index) => <div key={row.category}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{row.category}</span><strong>{formatPaise(row.amountPaise, { compact: true })}</strong></div>)}{categories.length > 6 && <small>+ {categories.length - 6} more categories</small>}</div></div> : <div className="finance-chart-empty">Expense category totals will appear here.</div>}
    </section>
  </div>;
}
