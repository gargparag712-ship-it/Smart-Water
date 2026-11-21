import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Ban, CalendarClock, CheckCircle2, Clock3, Eye, Pencil, Play, Plus, RefreshCw, Search, ShieldAlert, Wrench, X } from 'lucide-react';
import useMaintenance from '../hooks/useMaintenance.js';
import { filterMaintenance, maintenanceDateStatus, summarizeMaintenance } from '../utils/maintenanceDates.js';
import WorkOrderDialog from '../components/maintenance/WorkOrderDialog.jsx';
import WorkOrderDetails from '../components/maintenance/WorkOrderDetails.jsx';
import CompletionDialog from '../components/maintenance/CompletionDialog.jsx';

const emptyFilters = { search: '', maintenanceType: '', status: '', priority: '', fromDate: '', toDate: '' };
function date(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function Status({ record }) { const due = maintenanceDateStatus(record); return <div className="maintenance-status-cell"><span className={`maintenance-status status-${record.status.toLowerCase().replaceAll(' ', '-')}`}>{record.status}</span>{due === 'overdue' && <span className="maintenance-date-flag overdue">Overdue</span>}{due === 'dueToday' && <span className="maintenance-date-flag dueToday">Due today</span>}</div>; }

export default function MaintenancePage() {
  const { records, setRecords, assets, state, error, reload } = useMaintenance();
  const [filters, setFilters] = useState(emptyFilters); const [formRecord, setFormRecord] = useState(undefined); const [details, setDetails] = useState(null); const [completionRecord, setCompletionRecord] = useState(null); const [cancelRecord, setCancelRecord] = useState(null); const [busy, setBusy] = useState(false); const [dialogError, setDialogError] = useState(''); const [feedback, setFeedback] = useState('');
  const stats = useMemo(() => summarizeMaintenance(records), [records]); const visible = useMemo(() => filterMaintenance(records, filters), [records, filters]);
  function setFilter(name, value) { setFilters((old) => ({ ...old, [name]: value })); }
  async function saveRecord(fields) {
    setBusy(true); setDialogError('');
    try {
      const result = formRecord ? await window.smartWater.updateMaintenanceRecord(formRecord.id, fields) : await window.smartWater.createMaintenanceRecord(fields);
      if (!result?.ok) { setDialogError(result?.error || 'Could not save work order.'); return; }
      setRecords((old) => (formRecord ? old.map((row) => row.id === result.data.id ? result.data : row) : [...old, result.data]).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
      setFormRecord(undefined); setFeedback(formRecord ? 'Work order updated.' : `${result.data.workOrderCode} created.`);
    } catch { setDialogError('Could not save work order. Please try again.'); } finally { setBusy(false); }
  }
  async function changeStatus(record, transition, closeModal = false) {
    setBusy(true); setDialogError('');
    try {
      const result = await window.smartWater.updateMaintenanceStatus(record.id, transition);
      if (!result?.ok) { setDialogError(result?.error || 'Could not update work order status.'); return false; }
      setRecords((old) => old.map((row) => row.id === result.data.id ? result.data : row));
      if (closeModal) { setCompletionRecord(null); setCancelRecord(null); }
      setFeedback(`${result.data.workOrderCode} marked ${result.data.status.toLowerCase()}.`);
      return true;
    } catch { setDialogError('Could not update work order status. Please try again.'); return false; } finally { setBusy(false); }
  }
  async function startWork(record) { await changeStatus(record, { status: 'In Progress' }); }
  async function cancelWork() { if (await changeStatus(cancelRecord, { status: 'Cancelled' }, true)) setDialogError(''); }
  async function completeWork(transition) { await changeStatus(completionRecord, transition, true); }

  const statCards = [
    { label: 'Total work orders', value: stats.total, icon: Wrench, tone: 'teal' },
    { label: 'Scheduled', value: stats.scheduled, icon: CalendarClock, tone: 'blue' },
    { label: 'In progress', value: stats.inProgress, icon: Clock3, tone: 'amber' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, tone: 'green' },
    { label: 'Overdue', value: stats.overdue, icon: ShieldAlert, tone: 'rose' },
  ];
  return <div className="maintenance-page">
    <div className="maintenance-intro"><div><p>Plan inspections, coordinate repairs and preserve work history for every registered asset.</p><span><CheckCircle2 size={14} /> Saved locally · linked to Asset Management</span></div><button className="button-primary" type="button" disabled={state !== 'ready' || !assets.length} onClick={() => { setDialogError(''); setFormRecord(null); }}><Plus size={16} /> Add maintenance</button></div>
    {feedback && <div className="asset-feedback success" role="status"><CheckCircle2 size={16} />{feedback}<button type="button" aria-label="Dismiss" onClick={() => setFeedback('')}><X size={15} /></button></div>}
    {dialogError && formRecord === undefined && !completionRecord && !cancelRecord && <div className="asset-feedback error" role="alert"><AlertCircle size={16} />{dialogError}<button type="button" aria-label="Dismiss error" onClick={() => setDialogError('')}><X size={15} /></button></div>}
    <section className="maintenance-stats" aria-label="Maintenance summary">{statCards.map(({ label, value, icon: Icon, tone }) => <article className={`maintenance-stat tone-${tone}`} key={label}><span><Icon size={17} /></span><small>{label}</small><strong>{state === 'ready' ? value.toLocaleString() : '—'}</strong><i>LIVE</i></article>)}</section>

    <section className="panel maintenance-register"><header className="maintenance-section-heading"><div><span className="asset-section-eyebrow">PLANNING & REPAIRS</span><h2>Maintenance register</h2><p>Review schedules, progress and maintenance history linked to assets.</p></div><span className="live-records-tag"><i /> LIVE WORK ORDERS</span></header>
      <div className="maintenance-toolbar"><label className="maintenance-search"><Search size={16} /><input placeholder="Search work order, asset, title or technician…" aria-label="Search maintenance" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} /></label><select aria-label="Filter by maintenance type" value={filters.maintenanceType} onChange={(event) => setFilter('maintenanceType', event.target.value)}><option value="">All types</option><option>Preventive</option><option>Corrective</option></select><select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">All statuses</option><option>Scheduled</option><option>In Progress</option><option>Completed</option><option>Cancelled</option></select><select aria-label="Filter by priority" value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}><option value="">All priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select><label className="maintenance-date-filter">From<input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></label><label className="maintenance-date-filter">To<input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></label><span className="maintenance-result-count">{visible.length} of {records.length}</span></div>
      {state === 'loading' && <div className="asset-state-panel"><RefreshCw size={22} className="state-spinner" /><strong>Loading maintenance register</strong><span>Reading local work orders and assets…</span></div>}
      {state === 'error' && <div className="asset-state-panel error-state"><AlertCircle size={23} /><strong>Maintenance unavailable</strong><span>{error}</span><button className="button-secondary" type="button" onClick={reload}><RefreshCw size={14} /> Try again</button></div>}
      {state === 'ready' && !records.length && <div className="asset-state-panel"><span className="asset-empty-icon"><Wrench size={19} /></span><strong>No maintenance work orders yet</strong><span>{assets.length ? 'Create a scheduled inspection or repair for a registered asset.' : 'Add an asset in Asset Management before scheduling maintenance.'}</span>{assets.length > 0 && <button className="button-primary" type="button" onClick={() => setFormRecord(null)}><Plus size={15} /> Create first work order</button>}</div>}
      {state === 'ready' && records.length > 0 && !visible.length && <div className="asset-state-panel"><strong>No matching work orders</strong><span>Change or clear the filters to see more records.</span><button className="button-secondary" type="button" onClick={() => setFilters({ ...emptyFilters })}>Clear filters</button></div>}
      {state === 'ready' && visible.length > 0 && <div className="asset-table-scroll"><table className="asset-table maintenance-table"><thead><tr><th>Work order</th><th>Asset</th><th>Type / priority</th><th>Scheduled date</th><th>Assigned to</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><td><div className="table-asset"><span className="maintenance-order-icon"><Wrench size={14} /></span><span><strong>{record.title}</strong><small>{record.workOrderCode}</small></span></div></td><td><div className="scheme-cell"><strong>{record.assetName}</strong><small>{record.assetCode}</small></div></td><td><span className="maintenance-type-label">{record.maintenanceType}</span><small className={`maintenance-priority priority-${record.priority.toLowerCase()}`}>{record.priority}</small></td><td><span className="date-cell">{date(record.scheduledDate)}</span></td><td>{record.assignedTo || 'Unassigned'}</td><td><Status record={record} /></td><td><div className="row-actions"><button type="button" aria-label={`View ${record.workOrderCode}`} onClick={() => setDetails(record)}><Eye size={15} /></button>{!['Completed', 'Cancelled'].includes(record.status) && <button type="button" aria-label={`Edit ${record.workOrderCode}`} onClick={() => { setDialogError(''); setFormRecord(record); }}><Pencil size={14} /></button>}{record.status === 'Scheduled' && <><button type="button" aria-label={`Start ${record.workOrderCode}`} title="Start work" onClick={() => startWork(record)}><Play size={14} /></button><button className="delete-action" type="button" aria-label={`Cancel ${record.workOrderCode}`} title="Cancel work order" onClick={() => { setDialogError(''); setCancelRecord(record); }}><Ban size={14} /></button></>}{record.status === 'In Progress' && <button type="button" aria-label={`Complete ${record.workOrderCode}`} title="Complete work" onClick={() => { setDialogError(''); setCompletionRecord(record); }}><CheckCircle2 size={14} /></button>}</div></td></tr>)}</tbody></table></div>}
      {state === 'ready' && <footer className="directory-footer"><span>Work order codes are assigned by SmartWater. Completed history is preserved.</span><span>{records.length} {records.length === 1 ? 'work order' : 'work orders'}</span></footer>}
    </section>
    {state === 'ready' && <section className="maintenance-workflow-note"><ShieldAlert size={16} /><span>Workflow: Scheduled → In Progress → Completed. Scheduled orders can also be cancelled. Completed and cancelled records are locked as history.</span><ArrowRight size={14} /></section>}
    {formRecord !== undefined && <WorkOrderDialog key={formRecord?.id ?? 'new-work-order'} record={formRecord} assets={assets} busy={busy} error={dialogError} onClose={() => !busy && setFormRecord(undefined)} onSave={saveRecord} />}
    {details && <WorkOrderDetails record={details} onClose={() => setDetails(null)} onEdit={(record) => { setDetails(null); setDialogError(''); setFormRecord(record); }} />}
    {completionRecord && <CompletionDialog record={completionRecord} busy={busy} error={dialogError} onClose={() => !busy && setCompletionRecord(null)} onComplete={completeWork} />}
    {cancelRecord && <div className="dialog-backdrop" role="presentation"><section className="asset-dialog delete-dialog" role="alertdialog" aria-modal="true"><span className="delete-dialog-icon"><ShieldAlert size={21} /></span><h2>Cancel this work order?</h2><p><strong>{cancelRecord.workOrderCode}</strong> · {cancelRecord.title} for {cancelRecord.assetName} will be preserved with Cancelled status.</p>{dialogError && <div className="form-feedback error" role="alert">{dialogError}</div>}<footer className="delete-dialog-actions"><button className="button-secondary" type="button" onClick={() => setCancelRecord(null)} disabled={busy}>Keep scheduled</button><button className="button-danger" type="button" onClick={cancelWork} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel work order'}</button></footer></section></div>}
  </div>;
}
