import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { maintenanceDateStatus } from '../../utils/maintenanceDates.js';
function date(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
export default function WorkOrderDetails({ record, onClose, onEdit }) {
  const [asset, setAsset] = useState(null); const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    if (!window.smartWater?.getAsset || !window.smartWater?.listAssetMaintenanceHistory) { setHistoryLoaded(true); return () => { active = false; }; }
    Promise.all([window.smartWater.getAsset(record.assetId), window.smartWater.listAssetMaintenanceHistory(record.assetId)]).then(([assetResult, historyResult]) => {
      if (!active) return;
      if (assetResult?.ok) setAsset(assetResult.data);
      if (historyResult?.ok) setHistory(historyResult.data);
      setHistoryLoaded(true);
    }).catch(() => { if (active) setHistoryLoaded(true); });
    return () => { active = false; };
  }, [record.assetId]);
  const dateStatus = maintenanceDateStatus(record);
  return <div className="dialog-backdrop" role="presentation"><section className="asset-dialog maintenance-dialog detail-maintenance-dialog" role="dialog" aria-modal="true" aria-labelledby="work-order-detail-title">
    <header className="dialog-header"><div><span className="dialog-eyebrow">WORK ORDER · {record.workOrderCode}</span><h2 id="work-order-detail-title">{record.title}</h2><p>{record.maintenanceType} · {record.assetName} ({record.assetCode})</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close details"><X size={18} /></button></header>
    <div className="maintenance-detail-scroll"><div className="maintenance-detail-banner"><span className={`maintenance-status status-${record.status.toLowerCase().replaceAll(' ', '-')}`}>{record.status}</span><span className={`maintenance-priority priority-${record.priority.toLowerCase()}`}>{record.priority} priority</span>{dateStatus && <span className={`maintenance-date-flag ${dateStatus}`}>{dateStatus === 'dueToday' ? 'Due today' : dateStatus === 'upcoming' ? 'Upcoming' : 'Overdue'}</span>}</div>
      <div className="maintenance-information-grid"><section><small>SCHEDULED DATE</small><strong>{date(record.scheduledDate)}</strong></section><section><small>ASSIGNED TO</small><strong>{record.assignedTo || 'Unassigned'}</strong></section><section><small>ASSET STATUS NOW</small><strong>{asset?.status || 'Loading…'}</strong></section><section><small>ASSET LOCATION</small><strong>{asset?.location || '—'}</strong></section></div>
      <div className="maintenance-detail-text"><h3>Work description</h3><p>{record.description || 'No description provided.'}</p></div>
      {record.status === 'Completed' && <><div className="maintenance-detail-text"><h3>Work performed · {date(record.completionDate)}</h3><p>{record.workPerformed}</p></div><div className="maintenance-cost-breakdown"><span>Labour <strong>₹{record.labourCost.toLocaleString('en-IN')}</strong></span><span>Parts <strong>₹{record.partsCost.toLocaleString('en-IN')}</strong></span><span>Total <strong>₹{record.totalCost.toLocaleString('en-IN')}</strong></span></div></>}
      {record.remarks && <div className="maintenance-detail-text"><h3>Remarks</h3><p>{record.remarks}</p></div>}
      <section className="asset-maintenance-history"><h3>Asset maintenance history <span>{history.length}</span></h3>{history.length ? history.map((entry) => <div key={entry.id}><span>{date(entry.scheduledDate)}</span><strong>{entry.workOrderCode} · {entry.title}</strong><small>{entry.status}</small></div>) : <p>{historyLoaded ? 'No maintenance history available.' : 'Loading maintenance history…'}</p>}</section>
    </div><footer className="dialog-footer"><span className="dialog-footnote">Linked asset record is maintained in Asset Management.</span><div><button className="button-secondary" type="button" onClick={onClose}>Close</button>{!['Completed', 'Cancelled'].includes(record.status) && <button className="button-primary" type="button" onClick={() => onEdit(record)}>Edit work order</button>}</div></footer>
  </section></div>;
}
