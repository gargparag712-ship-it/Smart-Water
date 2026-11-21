import { AlertTriangle } from 'lucide-react';

export default function DeleteAssetDialog({ asset, busy, error, onCancel, onConfirm }) {
  return <div className="dialog-backdrop" role="presentation">
    <section className="asset-dialog delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-asset-title" aria-describedby="delete-asset-description">
      <span className="delete-dialog-icon"><AlertTriangle size={21} /></span>
      <h2 id="delete-asset-title">Delete this asset?</h2>
      <p id="delete-asset-description">You’re about to remove <strong>{asset.name}</strong> (<strong>{asset.assetCode}</strong>) from the asset register. This action cannot be undone.</p>
      {error && <div className="form-feedback error delete-error" role="alert">{error}</div>}
      <footer className="delete-dialog-actions"><button className="button-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button-danger" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete asset'}</button></footer>
    </section>
  </div>;
}
