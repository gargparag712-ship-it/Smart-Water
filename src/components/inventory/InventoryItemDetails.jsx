import { X } from 'lucide-react';
import { isLowStock } from '../../utils/filterInventory.js';
export default function InventoryItemDetails({ item, onClose, onEdit }) {
  const status = item.currentStock === 0 ? 'Out of stock' : isLowStock(item) ? 'Low stock' : 'In stock';
  return <div className="dialog-backdrop" role="presentation"><section className="asset-dialog inventory-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title">
    <header className="dialog-header"><div><span className="dialog-eyebrow">ITEM DETAILS · {item.itemCode}</span><h2 id="inventory-detail-title">{item.name}</h2><p>{item.category}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close details"><X size={18} /></button></header>
    <div className="inventory-detail-stock"><strong>{item.currentStock.toLocaleString()} <small>{item.unit}</small></strong><span className={`inventory-status ${item.currentStock === 0 ? 'out' : isLowStock(item) ? 'low' : 'good'}`}>{status}</span><p>Minimum threshold: {item.minimumStock} {item.unit}</p></div>
    <dl className="inventory-detail-grid">{[['Storage location', item.location], ['Supplier', item.supplier], ['Description', item.description], ['Created', new Date(item.createdAt).toLocaleDateString('en-IN')], ['Last updated', new Date(item.updatedAt).toLocaleDateString('en-IN')]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    <footer className="dialog-footer"><span className="dialog-footnote">Stock changes are recorded in transaction history.</span><div><button className="button-secondary" type="button" onClick={onClose}>Close</button><button className="button-primary" type="button" onClick={() => onEdit(item)}>Edit item</button></div></footer>
  </section></div>;
}
