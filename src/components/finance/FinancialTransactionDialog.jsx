import { useState } from 'react';
import { X } from 'lucide-react';
import { expenseCategories, incomeCategories, paymentMethods } from '../../data/financeOptions.js';
import { localDateString } from '../../utils/maintenanceDates.js';

export default function FinancialTransactionDialog({ transaction, initialType = 'Income', maintenanceOrders, maintenanceOrdersError, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(() => transaction ? { ...transaction, amount: (transaction.amountPaise / 100).toFixed(2), relatedWorkOrderId: transaction.relatedWorkOrderId || '' } : { type: initialType, title: '', category: '', amount: '', date: localDateString(), paymentMethod: 'UPI', referenceNumber: '', description: '', relatedWorkOrderId: '', partyName: '', notes: '' });
  const [issues, setIssues] = useState({});
  const categories = form.type === 'Income' ? incomeCategories : expenseCategories;
  function change(event) { const { name, value } = event.target; setForm((old) => ({ ...old, [name]: value, ...(name === 'type' ? { category: (value === 'Income' ? incomeCategories : expenseCategories)[0], relatedWorkOrderId: value === 'Income' ? '' : old.relatedWorkOrderId } : {}) })); setIssues((old) => ({ ...old, [name]: '' })); }
  function submit(event) { event.preventDefault(); const next = {}; if (!form.title.trim()) next.title = 'Transaction title is required.'; if (!form.category) next.category = 'Choose a category.'; if (!form.amount || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) next.amount = 'Enter an amount greater than ₹0.'; if (!form.date) next.date = 'Transaction date is required.'; setIssues(next); if (!Object.keys(next).length) onSave({ ...form, amount: form.amount.trim() }); }
  const textField = (name, label, props = {}) => <label className={`finance-field${issues[name] ? ' has-error' : ''}`}><span>{label}</span><input name={name} value={form[name] ?? ''} onChange={change} {...props} />{issues[name] && <small>{issues[name]}</small>}</label>;
  return <div className="dialog-backdrop" role="presentation"><section className="asset-dialog finance-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-form-title">
    <header className="dialog-header"><div><span className="dialog-eyebrow">FINANCIAL REGISTER</span><h2 id="finance-form-title">{transaction ? `Edit ${transaction.transactionCode}` : `Add ${form.type}`}</h2><p>{transaction ? 'Update the saved financial transaction.' : 'Record actual scheme income or expenses in Indian Rupees.'}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close form"><X size={18} /></button></header>
    <form onSubmit={submit}><div className="finance-form-scroll">{error && <div className="form-feedback error" role="alert">{error}</div>}<div className="finance-form-grid">
      <label className="finance-field"><span>Transaction type *</span><select name="type" value={form.type} onChange={change}><option>Income</option><option>Expense</option></select></label>
      {textField('title', 'Title *', { maxLength: 160, placeholder: 'e.g. November water charges' })}
      <label className={`finance-field${issues.category ? ' has-error' : ''}`}><span>Category *</span><select name="category" value={form.category} onChange={change}><option value="">Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>{issues.category && <small>{issues.category}</small>}</label>
      {textField('amount', 'Amount (₹) *', { type: 'number', min: '0.01', step: '0.01', placeholder: '0.00' })}
      {textField('date', 'Transaction date *', { type: 'date' })}
      <label className="finance-field"><span>Payment method *</span><select name="paymentMethod" value={form.paymentMethod} onChange={change}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
      {textField('partyName', form.type === 'Income' ? 'Payer' : 'Recipient / payee', { maxLength: 140, placeholder: 'Optional' })}
      {textField('referenceNumber', 'Reference number', { maxLength: 100, placeholder: 'Receipt, UTR or voucher number' })}
      {form.type === 'Expense' && <label className="finance-field full-width"><span>Related maintenance work order <em>Optional</em></span><select name="relatedWorkOrderId" value={form.relatedWorkOrderId} onChange={change}><option value="">No work order linked</option>{maintenanceOrders.map((order) => <option value={order.id} key={order.id}>{order.workOrderCode} · {order.assetCode} {order.assetName} · {order.title}</option>)}</select><small>{maintenanceOrdersError || 'This is a reference only. Maintenance costs are not copied into Finance.'}</small></label>}
      <label className="finance-field full-width"><span>Description</span><textarea name="description" value={form.description} onChange={change} maxLength={3000} rows={2} placeholder="Optional transaction description" /></label>
      <label className="finance-field full-width"><span>Notes</span><textarea name="notes" value={form.notes} onChange={change} maxLength={2000} rows={2} placeholder="Additional notes" /></label>
    </div></div><footer className="dialog-footer"><span className="dialog-footnote">Reference code is generated automatically. Amounts are saved in paise.</span><div><button className="button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : transaction ? 'Save changes' : `Add ${form.type}`}</button></div></footer></form>
  </section></div>;
}
