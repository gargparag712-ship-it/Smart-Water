import { AlertTriangle, ArrowRight, CalendarClock, CircleAlert } from 'lucide-react';
import PanelHeading from './PanelHeading.jsx';

const alertIcons = { critical: CircleAlert, warning: CalendarClock, overdue: AlertTriangle };
export default function AlertsPanel({ alerts }) {
  return <section className="panel alerts-panel">
    <PanelHeading eyebrow="ACTION REQUIRED" title="Alerts & reminders" action={<span className="alert-count">{alerts.length} OPEN</span>} />
    <div className="alerts-list">{alerts.map((alert) => {
      const Icon = alertIcons[alert.level];
      return <article className={`alert-row alert-${alert.level}`} key={alert.title}>
        <span className="alert-icon"><Icon size={16} strokeWidth={1.9} /></span>
        <div className="alert-copy"><strong>{alert.title}</strong><span>{alert.detail}</span><small>{alert.time}</small></div><ArrowRight className="alert-arrow" size={15} />
      </article>;
    })}</div>
    <div className="sample-note"><span /> Inventory alerts are live · maintenance reminders are illustrative</div>
  </section>;
}
