import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PanelHeading from './PanelHeading.jsx';

const money = (value) => `₹${value.toFixed(1)}L`;
function ExpenseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label} 2026</strong><span>Expenses <b>{money(payload[0].value)}</b></span></div>;
}

export default function ExpensesChart({ data }) {
  return <section className="panel chart-panel expenses-panel">
    <PanelHeading eyebrow="FINANCE OVERVIEW" title="Monthly expenses" subtitle="Illustrative spend across all schemes" action={<span className="chart-unit">₹ lakh <span>·</span> DEMO</span>} />
    <div className="chart-canvas expenses-canvas"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 6, bottom: 0, left: -14 }} barCategoryGap="32%">
        <CartesianGrid vertical={false} stroke="#edf1f0" strokeDasharray="3 4" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8a9a97', fontSize: 11 }} dy={9} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a9a97', fontSize: 10 }} tickFormatter={(value) => `₹${value}`} domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} />
        <Tooltip content={<ExpenseTooltip />} cursor={{ fill: '#f3f7f6' }} />
        <Bar dataKey="expense" fill="#248e7d" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer></div>
    <div className="chart-footer"><span><i className="legend-dot teal-dot" /> Current year</span><span>Sample figures for demonstration</span></div>
  </section>;
}
