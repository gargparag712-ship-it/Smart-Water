import { useState } from 'react';
import { X } from 'lucide-react';
function localDate() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); }
export default function StockMovementDialog({ type, items, busy, error, onClose, onSubmit }) {
  const [form, setForm] = useState({ itemId: '', quantity: '', date: localDate(), referenceNumber: '', partyOrSupplier: '', notes: '' });
  const [issue, setIssue] = useState('');
  const selected = items.find((item) => item.id === form.itemId);
  function change(event) { setForm((old) => ({ ...old, [event.target.name]: event.target.value })); setIssue(''); }
  function submit(event) { event.preventDefault(); const qty = Number(form.quantity); if (!form.itemId || !form.quantity || !Number.isFinite(qty) || qty <= 0) { setIssue('Select an item and enter a quantity greater than zero.'); return; } if (type === 'OUT' && qty > selected.currentStock) { setIssue(`Only ${selected.currentStock} ${selected.unit} is available.`); return; } onSubmit({ ...form, quantity: qty }); }
  return <div className="dialog-backdrop" role="presentation"><section className="asset-dialog inventory-dialog movement-dialog" role="dialog" aria-modal="true" aria-labelledby="movement-title">
    <header className="dialog-header"><div><span className="dialog-eyebrow">INVENTORY MOVEMENT</span><h2 id="movement-title">Stock {type === 'IN' ? 'In' : 'Out'}</h2><p>{type === 'IN' ? 'Record a delivery into your store.' : 'Record stock issued or consumed.'}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close movement form"><X size={18} /></button></header>
    <form onSubmit={submit}><div className="inventory-form-scroll">{error && <div className="form-feedback error" role="alert">{error}</div>}{issue && <div className="form-feedback error" role="alert">{issue}</div>}<div className="inventory-form-grid">
      <label className="inventory-field full-width"><span>Inventory item *</span><select name="itemId" value={form.itemId} onChange={change}><option value="">Choose an item</option>{items.map((item) => <option value={item.id} key={item.id}>{item.itemCode} · {item.name} ({item.currentStock} {item.unit})</option>)}</select></label>
      <label className="inventory-field"><span>Quantity *</span><input name="quantity" type="number" min="0.000001" step="any" value={form.quantity} onChange={change} /></label>
      <label className="inventory-field"><span>Date *</span><input name="date" type="date" value={form.date} onChange={change} /></label>
      <label className="inventory-field"><span>Reference number</span><input name="referenceNumber" maxLength={100} value={form.referenceNumber} onChange={change} placeholder="Optional" /></label>
      <label className="inventory-field"><span>{type === 'IN' ? 'Supplier' : 'Recipient / usage'}</span><input name="partyOrSupplier" maxLength={120} value={form.partyOrSupplier} onChange={change} placeholder="Optional" /></label>
      <label className="inventory-field full-width"><span>Notes</span><textarea name="notes" value={form.notes} onChange={change} maxLength={1000} rows={3} /></label>
    </div>{selected && <div className="movement-preview"><span>Available now</span><strong>{selected.currentStock} {selected.unit}</strong><span>After movement</span><strong>{type === 'IN' ? selected.currentStock + (Number(form.quantity) || 0) : selected.currentStock - (Number(form.quantity) || 0)} {selected.unit}</strong></div>}</div>
    <footer className="dialog-footer"><span className="dialog-footnote">A permanent transaction record will be created.</span><div><button className="button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button-primary" type="submit" disabled={busy || !items.length}>{busy ? 'Saving…' : `Record Stock ${type}`}</button></div></footer></form>
  </section></div>;
}
