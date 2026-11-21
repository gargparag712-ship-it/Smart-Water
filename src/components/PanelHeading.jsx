export default function PanelHeading({ eyebrow, title, subtitle, action }) {
  return <div className="panel-heading"><div>{eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
