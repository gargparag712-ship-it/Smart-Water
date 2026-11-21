import { ArrowUpRight, Boxes, CircleDollarSign, Package, Wrench } from 'lucide-react';
import PanelHeading from './PanelHeading.jsx';

const activityIcons = { asset: Boxes, stock: Package, maintenance: Wrench, finance: CircleDollarSign };
export default function RecentActivities({ activities }) {
  return <section className="panel activity-panel">
    <PanelHeading eyebrow="ACTIVITY LOG" title="Recent activity" subtitle="A quick look at recent scheme updates" action={<button className="text-action" type="button">View all <ArrowUpRight size={14} /></button>} />
    <div className="activity-list">{activities.map((activity) => {
      const Icon = activityIcons[activity.type];
      return <article className="activity-row" key={activity.title}>
        <span className={`activity-icon activity-${activity.color}`}><Icon size={16} strokeWidth={1.9} /></span>
        <div className="activity-copy"><strong>{activity.title}</strong><span>{activity.subtitle}</span></div><time>{activity.time}</time>
      </article>;
    })}</div>
    <div className="sample-note"><span /> Sample activity · Not connected to live scheme records</div>
  </section>;
}
