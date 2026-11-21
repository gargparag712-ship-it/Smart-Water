import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PanelHeading from './PanelHeading.jsx';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
function ExpenseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong><span>Expenses <b>{money(payload[0].value)}</b></span></div>;
}

export default function ExpensesChart({ summary, state }) {
  const data = summary?.monthlyTotals?.map((row) => ({ month: `${row.label} '${String(row.year).slice(-2)}`, expense: row.expensePaise / 100 })) ?? [];
  return <section className="panel chart-panel expenses-panel">
    <PanelHeading eyebrow="FINANCE OVERVIEW" title="Monthly expenses" subtitle="Calendar month totals from saved transactions" action={<span className="chart-unit">INR <span>·</span> LIVE</span>} />
    {state === 'loading' && <div className="asset-chart-empty">Loading financial totals…</div>}
    {state === 'error' && <div className="asset-chart-empty">Financial totals are unavailable until local records can be read.</div>}
    {state === 'ready' && !data.some((row) => row.expense > 0) && <div className="asset-chart-empty">Add expense transactions to see monthly totals.</div>}
    {state === 'ready' && data.some((row) => row.expense > 0) && <div className="chart-canvas expenses-canvas"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 6, bottom: 0, left: -14 }} barCategoryGap="32%">
        <CartesianGrid vertical={false} stroke="#edf1f0" strokeDasharray="3 4" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8a9a97', fontSize: 11 }} dy={9} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a9a97', fontSize: 9 }} tickFormatter={(value) => value >= 100000 ? `₹${(value / 100000).toFixed(0)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`} />
        <Tooltip content={<ExpenseTooltip />} cursor={{ fill: '#f3f7f6' }} />
        <Bar dataKey="expense" fill="#248e7d" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer></div>}
    <div className="chart-footer"><span><i className="legend-dot teal-dot" /> Monthly expense</span><span>From local financial transactions</span></div>
  </section>;
}
