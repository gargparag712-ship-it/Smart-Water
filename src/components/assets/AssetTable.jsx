import { Eye, Pencil, Trash2 } from 'lucide-react';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function AssetTable({ assets, onView, onEdit, onDelete }) {
  return <div className="asset-table-scroll"><table className="asset-table">
    <thead><tr><th scope="col">Asset</th><th scope="col">Category</th><th scope="col">Scheme / location</th><th scope="col">Condition</th><th scope="col">Status</th><th scope="col">Installed</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{assets.map((asset) => <tr key={asset.id}>
      <td><div className="table-asset"><span className="asset-initial">{asset.category.slice(0, 1)}</span><span><strong>{asset.name}</strong><small>{asset.assetCode}</small></span></div></td>
      <td><span className="category-cell">{asset.category}</span></td>
      <td><div className="scheme-cell"><strong>{asset.scheme || '—'}</strong><small>{asset.location || 'Location not specified'}</small></div></td>
      <td><span className={`condition-pill condition-${asset.condition.toLowerCase()}`}><i />{asset.condition}</span></td>
      <td><span className={`status-pill status-${asset.status.toLowerCase().replaceAll(' ', '-')}`}>{asset.status}</span></td>
      <td><span className="date-cell">{formatDate(asset.installationDate)}</span></td>
      <td><div className="row-actions"><button type="button" aria-label={`View ${asset.name}`} title="View details" onClick={() => onView(asset)}><Eye size={15} /></button><button type="button" aria-label={`Edit ${asset.name}`} title="Edit asset" onClick={() => onEdit(asset)}><Pencil size={14} /></button><button className="delete-action" type="button" aria-label={`Delete ${asset.name}`} title="Delete asset" onClick={() => onDelete(asset)}><Trash2 size={14} /></button></div></td>
    </tr>)}</tbody>
  </table></div>;
}
