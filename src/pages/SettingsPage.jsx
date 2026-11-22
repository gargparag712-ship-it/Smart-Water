import { useState } from 'react';
import { AlertCircle, Archive, CheckCircle2, Download, RefreshCw, ShieldCheck, Upload } from 'lucide-react';

export default function SettingsPage() {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  async function run(action) {
    setBusy(action); setMessage(null);
    try {
      const result = action === 'export' ? await window.smartWater.exportBackup() : await window.smartWater.restoreBackup();
      if (!result?.ok) throw new Error(result?.error || 'The backup operation failed.');
      if (result.cancelled) setMessage({ type: 'info', text: action === 'export' ? 'Backup export was cancelled.' : 'Restore was cancelled. No data was changed.' });
      else if (action === 'export') setMessage({ type: 'success', text: `Backup saved as ${result.data.fileName}.` });
      else setMessage({ type: 'success', text: `Backup restored. A safety copy was saved as ${result.data.safetyBackupFile} in SmartWater’s local data folder.` });
    } catch (error) { setMessage({ type: 'error', text: error.message || 'The backup operation failed. Please try again.' }); }
    finally { setBusy(''); }
  }
  return <div className="settings-page"><div className="settings-intro"><p>Manage local data protection for this SmartWater installation.</p><span><ShieldCheck size={14}/> Local device storage</span></div>
    {message && <div className={`asset-feedback ${message.type === 'error' ? 'error' : 'success'}`} role="status">{message.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}<span>{message.text}</span></div>}
    <section className="panel settings-backup-card"><div className="settings-card-icon"><Archive size={21}/></div><div className="settings-card-content"><span className="asset-section-eyebrow">DATA PORTABILITY</span><h2>Backup and restore</h2><p>Export all SmartWater JSON collections to a versioned backup file, or restore a previous backup. Restore checks the file structure and references, asks for confirmation, and creates a safety backup before replacing current records.</p><div className="settings-actions"><button className="button-primary" onClick={() => run('export')} disabled={Boolean(busy)}><Download size={15}/>{busy === 'export' ? 'Preparing backup…' : 'Export backup'}</button><button className="button-secondary" onClick={() => run('restore')} disabled={Boolean(busy)}><Upload size={15}/>{busy === 'restore' ? 'Preparing restore…' : 'Restore backup'}</button></div></div></section>
    <section className="panel settings-note"><div><strong>Stored on this device</strong><p>SmartWater does not synchronize records to a cloud service. Keep exported backup files somewhere safe. Restoring replaces all current application records.</p></div></section>
    {busy && <p className="settings-progress"><RefreshCw size={14} className="state-spinner"/> SmartWater is preparing the selected operation…</p>}
  </div>;
}
