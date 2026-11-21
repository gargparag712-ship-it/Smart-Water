import { useState } from 'react';
import { X } from 'lucide-react';
import { assetCategories, assetConditions, assetStatuses } from '../../data/assetOptions.js';

const emptyAsset = {
  assetCode: '', name: '', category: '', scheme: '', location: '', manufacturer: '',
  modelNumber: '', serialNumber: '', purchaseDate: '', installationDate: '',
  condition: 'Good', status: 'Active', description: '',
};

function validateForm(asset, existingAssets, editingId) {
  const errors = {};
  if (!asset.assetCode.trim()) errors.assetCode = 'Asset code is required.';
  else if (!/^[a-z0-9][a-z0-9._/-]{0,39}$/i.test(asset.assetCode.trim())) errors.assetCode = 'Use letters, numbers, dots, underscores, hyphens or slashes.';
  else if (existingAssets.some((item) => item.id !== editingId && item.assetCode.toLocaleUpperCase() === asset.assetCode.trim().toLocaleUpperCase())) errors.assetCode = 'This asset code is already in use.';
  if (!asset.name.trim()) errors.name = 'Asset name is required.';
  if (!asset.category) errors.category = 'Choose a category.';
  if (asset.purchaseDate && asset.installationDate && asset.installationDate < asset.purchaseDate) errors.installationDate = 'Installation date cannot be before purchase date.';
  return errors;
}

function TextField({ label, name, value, onChange, error, ...props }) {
  return <label className={`asset-field${error ? ' has-error' : ''}`}><span>{label}</span><input name={name} value={value} onChange={onChange} {...props} />{error && <small>{error}</small>}</label>;
}

function SelectField({ label, name, value, options, onChange, error, placeholder }) {
  return <label className={`asset-field${error ? ' has-error' : ''}`}><span>{label}</span><select name={name} value={value} onChange={onChange}><option value="">{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{error && <small>{error}</small>}</label>;
}

export default function AssetFormDialog({ asset, assets, busy, serverError, onClose, onSubmit }) {
  const [form, setForm] = useState(() => asset ? { ...emptyAsset, ...asset } : { ...emptyAsset });
  const [errors, setErrors] = useState({});
  const editing = Boolean(asset);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm(form, assets, asset?.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const fields = { ...form };
    delete fields.id;
    delete fields.createdAt;
    delete fields.updatedAt;
    await onSubmit(fields);
  }

  return <div className="dialog-backdrop" role="presentation">
    <section className="asset-dialog asset-form-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-form-title">
      <header className="dialog-header"><div><span className="dialog-eyebrow">ASSET REGISTER</span><h2 id="asset-form-title">{editing ? 'Edit asset' : 'Add asset'}</h2><p>{editing ? 'Update this asset’s details.' : 'Add a new item to your scheme asset register.'}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close form"><X size={18} /></button></header>
      <form onSubmit={handleSubmit} noValidate>
        <div className="asset-form-scroll">
          {serverError && <div className="form-feedback error" role="alert">{serverError}</div>}
          <div className="form-section-heading"><strong>Asset information</strong><span>Required fields are marked with *</span></div>
          <div className="form-grid">
            <TextField label="Asset code *" name="assetCode" value={form.assetCode} onChange={handleChange} error={errors.assetCode} placeholder="e.g. PMP-0042" maxLength={40} autoFocus />
            <TextField label="Asset name *" name="name" value={form.name} onChange={handleChange} error={errors.name} placeholder="e.g. Borewell Pump 1" maxLength={120} />
            <SelectField label="Category *" name="category" value={form.category} onChange={handleChange} options={assetCategories} error={errors.category} placeholder="Select category" />
            <SelectField label="Condition" name="condition" value={form.condition} onChange={handleChange} options={assetConditions} placeholder="Select condition" />
            <TextField label="Scheme / project" name="scheme" value={form.scheme} onChange={handleChange} error={errors.scheme} placeholder="Scheme name" maxLength={120} />
            <TextField label="Physical location" name="location" value={form.location} onChange={handleChange} error={errors.location} placeholder="e.g. Pump house, east wing" maxLength={160} />
          </div>

          <div className="form-section-heading"><strong>Equipment details</strong><span>Optional</span></div>
          <div className="form-grid">
            <TextField label="Manufacturer" name="manufacturer" value={form.manufacturer} onChange={handleChange} error={errors.manufacturer} placeholder="Manufacturer name" maxLength={120} />
            <TextField label="Model number" name="modelNumber" value={form.modelNumber} onChange={handleChange} error={errors.modelNumber} placeholder="Model number" maxLength={100} />
            <TextField label="Serial number" name="serialNumber" value={form.serialNumber} onChange={handleChange} error={errors.serialNumber} placeholder="Serial number" maxLength={100} />
            <SelectField label="Operational status" name="status" value={form.status} onChange={handleChange} options={assetStatuses} placeholder="Select status" />
            <TextField label="Purchase date" name="purchaseDate" value={form.purchaseDate} onChange={handleChange} error={errors.purchaseDate} type="date" />
            <TextField label="Installation date" name="installationDate" value={form.installationDate} onChange={handleChange} error={errors.installationDate} type="date" />
            <label className="asset-field full-width"><span>Description</span><textarea name="description" value={form.description} onChange={handleChange} maxLength={2000} rows={3} placeholder="Add notes about this asset..." /></label>
          </div>
        </div>
        <footer className="dialog-footer"><span className="dialog-footnote">Asset ID and timestamps are assigned automatically.</span><div><button className="button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add asset'}</button></div></footer>
      </form>
    </section>
  </div>;
}
