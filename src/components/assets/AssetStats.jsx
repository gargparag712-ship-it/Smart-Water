import { Activity, Boxes, Wrench } from 'lucide-react';

const stats = [
  { key: 'total', label: 'Total assets', icon: Boxes, tone: 'teal' },
  { key: 'active', label: 'Active assets', icon: Activity, tone: 'green' },
  { key: 'maintenance', label: 'Under maintenance', icon: Wrench, tone: 'amber' },
];

export default function AssetStats({ assets, loading }) {
  const counts = {
    total: assets.length,
    active: assets.filter((asset) => asset.status === 'Active').length,
    maintenance: assets.filter((asset) => asset.status === 'Under Maintenance').length,
  };

  return <section className="asset-stats" aria-label="Asset counts">
    {stats.map(({ key, label, icon: Icon, tone }) => <article className={`asset-stat tone-${tone}`} key={key}>
      <span className="asset-stat-icon"><Icon size={17} /></span>
      <span className="asset-stat-copy"><span>{label}</span><strong>{loading ? '—' : counts[key].toLocaleString()}</strong></span>
      <span className="asset-stat-source">LIVE</span>
    </article>)}
  </section>;
}
