import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, RefreshCw, X } from 'lucide-react';
import AssetStats from '../components/assets/AssetStats.jsx';
import AssetFilters from '../components/assets/AssetFilters.jsx';
import AssetTable from '../components/assets/AssetTable.jsx';
import AssetFormDialog from '../components/assets/AssetFormDialog.jsx';
import AssetDetailsDialog from '../components/assets/AssetDetailsDialog.jsx';
import DeleteAssetDialog from '../components/assets/DeleteAssetDialog.jsx';
import useAssets from '../hooks/useAssets.js';
import { filterAssets, filtersAreActive } from '../utils/filterAssets.js';

const emptyFilters = { search: '', category: '', condition: '', status: '' };

export default function AssetsPage() {
  const { assets, setAssets, state, error, reload } = useAssets();
  const [filters, setFilters] = useState(emptyFilters);
  const [formAsset, setFormAsset] = useState(undefined);
  const [detailAsset, setDetailAsset] = useState(null);
  const [deleteAsset, setDeleteAsset] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [serverError, setServerError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const visibleAssets = useMemo(() => filterAssets(assets, filters), [assets, filters]);
  const hasFilters = filtersAreActive(filters);

  function openCreate() {
    setServerError('');
    setFormAsset(null);
  }

  function openEdit(asset) {
    setServerError('');
    setDetailAsset(null);
    setFormAsset(asset);
  }

  async function saveAsset(fields) {
    setBusy(true);
    setServerError('');
    try {
      const result = formAsset
        ? await window.smartWater.updateAsset(formAsset.id, fields)
        : await window.smartWater.createAsset(fields);
      if (!result?.ok || !result.data) {
        setServerError(result?.error || 'SmartWater could not save this asset. Please try again.');
        return;
      }
      const savedAsset = result.data;
      setAssets((current) => {
        const next = formAsset
          ? current.map((item) => item.id === savedAsset.id ? savedAsset : item)
          : [...current, savedAsset];
        return next.sort((a, b) => a.assetCode.localeCompare(b.assetCode));
      });
      setFormAsset(undefined);
      setFeedback({ type: 'success', message: formAsset ? `${savedAsset.name} was updated.` : `${savedAsset.name} was added to your asset register.` });
    } catch {
      setServerError('SmartWater could not save this asset. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      if (!window.smartWater?.deleteAsset) {
        setDeleteError('Asset deletion is available only in the SmartWater desktop application.');
        return;
      }
      const result = await window.smartWater.deleteAsset(deleteAsset.id);
      if (!result?.ok) {
        setDeleteError(result?.error || 'SmartWater could not delete this asset.');
        return;
      }
      setAssets((current) => current.filter((item) => item.id !== deleteAsset.id));
      setFeedback({ type: 'success', message: `${result.data.name} (${result.data.assetCode}) was deleted.` });
      setDeleteAsset(null);
    } catch {
      setDeleteError('SmartWater could not delete this asset. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function askDelete(asset) {
    setDeleteError('');
    setDeleteAsset(asset);
  }

  return <div className="assets-page">
      <div className="assets-page-intro"><div><p>Register and keep track of equipment across your water supply schemes.</p><span className="assets-live-note"><CheckCircle2 size={14} /> Saved locally on this device</span></div><button className="button-primary add-asset-button" type="button" onClick={openCreate} disabled={state !== 'ready'}><Plus size={16} /> Add asset</button></div>

    {feedback && <div className={`asset-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}><span className="feedback-icon">{feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</span><span>{feedback.message}</span><button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)}><X size={15} /></button></div>}

    <AssetStats assets={assets} loading={state !== 'ready'} />

    <section className="asset-directory panel">
      <div className="asset-directory-heading"><div><span className="asset-section-eyebrow">ASSET REGISTER</span><h2>All assets</h2><p>Search, filter and manage your registered equipment.</p></div><span className="live-records-tag"><i /> LIVE RECORDS</span></div>
      <AssetFilters filters={filters} onChange={updateFilter} onClear={() => setFilters({ ...emptyFilters })} hasFilters={hasFilters} resultCount={visibleAssets.length} totalCount={assets.length} />

      {state === 'loading' && <div className="asset-state-panel"><RefreshCw className="state-spinner" size={22} /><strong>Loading asset register</strong><span>Reading locally stored asset records…</span></div>}
      {state === 'error' && <div className="asset-state-panel error-state"><AlertCircle size={23} /><strong>Asset register unavailable</strong><span>{error}</span><button className="button-secondary" type="button" onClick={reload}><RefreshCw size={14} /> Try again</button></div>}
      {state === 'ready' && assets.length === 0 && <div className="asset-state-panel"><span className="asset-empty-icon"><Plus size={20} /></span><strong>Your asset register is ready</strong><span>Add your first pump, valve, tank or other scheme asset to begin.</span><button className="button-primary" type="button" onClick={openCreate}><Plus size={15} /> Add your first asset</button></div>}
      {state === 'ready' && assets.length > 0 && visibleAssets.length === 0 && <div className="asset-state-panel"><span className="asset-empty-icon"><RefreshCw size={19} /></span><strong>No matching assets</strong><span>Try another search or clear the filters to see all records.</span><button className="button-secondary" type="button" onClick={() => setFilters({ ...emptyFilters })}>Clear filters</button></div>}
      {state === 'ready' && visibleAssets.length > 0 && <AssetTable assets={visibleAssets} onView={setDetailAsset} onEdit={openEdit} onDelete={askDelete} />}
      {state === 'ready' && <div className="directory-footer"><span>Asset codes and statuses are validated when saved.</span><span>{assets.length.toLocaleString()} {assets.length === 1 ? 'record' : 'records'}</span></div>}
    </section>

    {formAsset !== undefined && <AssetFormDialog key={formAsset?.id ?? 'new-asset'} asset={formAsset} assets={assets} busy={busy} serverError={serverError} onClose={() => !busy && setFormAsset(undefined)} onSubmit={saveAsset} />}
    {detailAsset && <AssetDetailsDialog asset={detailAsset} busy={busy} onClose={() => setDetailAsset(null)} onEdit={openEdit} />}
    {deleteAsset && <DeleteAssetDialog asset={deleteAsset} busy={busy} error={deleteError} onCancel={() => !busy && setDeleteAsset(null)} onConfirm={confirmDelete} />}
  </div>;
}
