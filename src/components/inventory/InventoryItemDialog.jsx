import { useState } from 'react';
import { X } from 'lucide-react';
import { inventoryCategories, inventoryUnits } from '../../data/inventoryOptions.js';

const blank = { itemCode: '', name: '', category: '', unit: 'piece', currentStock: '0', minimumStock: '0', location: '', supplier: '', description: '' };
export default function InventoryItemDialog({ item, items, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(() => item ? { ...item, currentStock: String(item.currentStock), minimumStock: String(item.minimumStock) } : blank);
  const [issues, setIssues] = useState({});
  function change(event) { const { name, value } = event.target; setForm((prev) => ({ ...prev, [name]: value })); setIssues((prev) => ({ ...prev, [name]: '' })); }
  function submit(event) {
    event.preventDefault(); const next = {};
    if (!form.itemCode.trim()) next.itemCode = 'Item code is required.';
    else if (!/^[a-z0-9][a-z0-9._/-]{0,39}$/i.test(form.itemCode.trim())) next.itemCode = 'Use letters, numbers, dots, underscores, hyphens or slashes.';
    else if (items.some((entry) => entry.id !== item?.id && entry.itemCode.toUpperCase() === form.itemCode.trim().toUpperCase())) next.itemCode = 'This item code is already in use.';
    if (!form.name.trim()) next.name = 'Item name is required.';
    if (!form.category) next.category = 'Choose a category.';
    for (const field of ['currentStock', 'minimumStock']) if (form[field] === '' || !Number.isFinite(Number(form[field])) || Number(form[field]) < 0) next[field] = 'Enter a valid zero or positive amount.';
    if (!form.unit.trim()) next.unit = 'Unit is required.';
    setIssues(next); if (Object.keys(next).length) return;
    onSave({ ...form, itemCode: form.itemCode.trim(), name: form.name.trim(), currentStock: Number(form.currentStock), minimumStock: Number(form.minimumStock) });
  }
  const textField = (name, label, props = {}) => <label className={`inventory-field${issues[name] ? ' has-error' : ''}`}><span>{label}</span><input name={name} value={form[name] ?? ''} onChange={change} {...props} />{issues[name] && <small>{issues[name]}</small>}</label>;
  const selectField = (name, label, values) => <label className={`inventory-field${issues[name] ? ' has-error' : ''}`}><span>{label}</span><select name={name} value={form[name]} onChange={change}><option value="">Select {label.toLowerCase()}</option>{values.map((value) => <option key={value}>{value}</option>)}</select>{issues[name] && <small>{issues[name]}</small>}</label>;
  return <div className="dialog-backdrop" role="presentation"><section className="asset-dialog inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-form-title">
    <header className="dialog-header"><div><span className="dialog-eyebrow">INVENTORY REGISTER</span><h2 id="inventory-form-title">{item ? 'Edit item' : 'Add inventory item'}</h2><p>Keep item and available quantity details up to date.</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close form"><X size={18} /></button></header>
    <form onSubmit={submit}><div className="inventory-form-scroll">{error && <div className="form-feedback error" role="alert">{error}</div>}<div className="inventory-form-grid">
      {textField('itemCode', 'Item code *', { maxLength: 40, placeholder: 'e.g. CHL-001' })}{textField('name', 'Item name *', { maxLength: 120, placeholder: 'e.g. Chlorine tablets' })}
      {selectField('category', 'Category *', inventoryCategories)}<label className={`inventory-field${issues.unit ? ' has-error' : ''}`}><span>Unit *</span><input name="unit" list="inventory-unit-options" value={form.unit} onChange={change} maxLength={30} placeholder="e.g. packet" /><datalist id="inventory-unit-options">{inventoryUnits.map((value) => <option value={value} key={value} />)}</datalist>{issues.unit && <small>{issues.unit}</small>}</label>
      {textField('currentStock', 'Current stock', { type: 'number', min: 0, step: 'any', readOnly: Boolean(item), title: item ? 'Use Stock In or Stock Out to change quantity' : undefined })}{textField('minimumStock', 'Minimum stock threshold', { type: 'number', min: 0, step: 'any' })}
      {textField('location', 'Storage location', { maxLength: 160, placeholder: 'e.g. Main store' })}{textField('supplier', 'Supplier', { maxLength: 120, placeholder: 'Optional' })}
      <label className="inventory-field full-width"><span>Description</span><textarea name="description" value={form.description} onChange={change} maxLength={2000} rows={3} /></label>
    </div>{item && <p className="inventory-note">For accurate stock history, use Stock In or Stock Out to adjust quantity.</p>}</div><footer className="dialog-footer"><span className="dialog-footnote">Item ID and timestamps are assigned automatically.</span><div><button className="button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button></div></footer></form>
  </section></div>;
}
