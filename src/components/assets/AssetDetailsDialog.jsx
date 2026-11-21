import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Pencil, X } from 'lucide-react';

function display(value) { return value || '—'; }
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export default function AssetDetailsDialog({ asset, busy, onClose, onEdit }) {
  const [record, setRecord] = useState(asset);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (window.smartWater?.getAsset) {
      window.smartWater.getAsset(asset.id).then((result) => {
        if (!active) return;
        if (result?.ok) setRecord(result.data);
        else setError(result?.error || 'Could not load asset details.');
      }).catch(() => { if (active) setError('Could not load asset details.'); });
    }
    return () => { active = false; };
  }, [asset.id]);

  return <div className="dialog-backdrop" role="presentation">
    <section className="asset-dialog asset-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-details-title">
      <header className="dialog-header"><div><span className="dialog-eyebrow">ASSET DETAILS</span><h2 id="asset-details-title">{record.name}</h2><p className="detail-code">{record.assetCode}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close details"><X size={18} /></button></header>
      {error && <div className="form-feedback error detail-error" role="alert">{error}</div>}
      <div className="detail-overview"><span className="detail-category-icon">{record.category.slice(0, 1)}</span><div><strong>{record.category}</strong><span><MapPin size={13} />{display(record.location)}</span></div><span className={`status-pill status-${record.status.toLowerCase().replaceAll(' ', '-')}`}>{record.status}</span></div>
      <div className="asset-detail-grid">
        <DetailItem label="Scheme / project" value={record.scheme} />
        <DetailItem label="Condition" value={record.condition} />
        <DetailItem label="Manufacturer" value={record.manufacturer} />
        <DetailItem label="Model number" value={record.modelNumber} />
        <DetailItem label="Serial number" value={record.serialNumber} />
        <DetailItem label="Purchase date" value={formatDate(record.purchaseDate)} icon={<CalendarDays size={13} />} />
        <DetailItem label="Installation date" value={formatDate(record.installationDate)} icon={<CalendarDays size={13} />} />
        <DetailItem label="Created" value={new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(record.createdAt))} />
        <DetailItem label="Last updated" value={new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(record.updatedAt))} />
        <div className="detail-item full-width"><span>Description</span><p>{display(record.description)}</p></div>
      </div>
      <footer className="dialog-footer"><span className="dialog-footnote">Asset ID: {record.id}</span><div><button className="button-secondary" type="button" onClick={onClose}>Close</button><button className="button-primary" type="button" onClick={() => onEdit(record)} disabled={busy}><Pencil size={14} /> Edit asset</button></div></footer>
    </section>
  </div>;
}

function DetailItem({ label, value, icon }) {
  return <div className="detail-item"><span>{label}</span><strong>{icon}{display(value)}</strong></div>;
}
