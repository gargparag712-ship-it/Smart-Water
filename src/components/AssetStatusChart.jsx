import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import PanelHeading from './PanelHeading.jsx';

function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: point } = payload[0];
  return <div className="chart-tooltip"><strong>{name}</strong><span>{value.toLocaleString()} assets <i style={{ background: point.color }} /></span></div>;
}

export default function AssetStatusChart({ data, state }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <section className="panel chart-panel status-panel">
    <PanelHeading eyebrow="ASSET HEALTH" title="Asset status" subtitle="Current operational mix from local records" action={<span className="chart-unit">LIVE</span>} />
    {state === 'loading' && <div className="asset-chart-empty">Loading saved asset statuses…</div>}
    {state === 'error' && <div className="asset-chart-empty">Asset status is unavailable until local records can be read.</div>}
    {state === 'ready' && total === 0 && <div className="asset-chart-empty">Add assets to see the live status distribution.</div>}
    {state === 'ready' && total > 0 && <div className="status-chart-content"><div className="donut-wrap">
      <ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={81} paddingAngle={3} stroke="none" cornerRadius={3}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie>
        <Tooltip content={<StatusTooltip />} />
      </PieChart></ResponsiveContainer>
      <div className="donut-center"><strong>{total.toLocaleString()}</strong><span>ASSETS</span></div>
    </div><div className="status-legend">
      {data.map((item) => <div className="status-legend-row" key={item.name}><span className="legend-dot" style={{ background: item.color }} /><span>{item.name}</span><strong>{item.value.toLocaleString()}</strong></div>)}
    </div></div>}
    <div className="chart-footer"><span>From your local asset register</span><span>Updates when this page opens</span></div>
  </section>;
}
