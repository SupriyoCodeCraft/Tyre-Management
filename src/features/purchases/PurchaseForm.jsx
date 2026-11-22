import { useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { createId } from '../../data/database/recordUtils.js';
import { savePurchase } from '../../services/purchaseService.js';

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function blankTyre() {
  return { rowId: createId(), serialNumber: '', initialNsd: '' };
}

export function PurchaseForm({ vendors, onCancel, onSaved }) {
  const [vendorMode, setVendorMode] = useState(vendors.length ? 'existing' : 'new');
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const [newVendorName, setNewVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayDate);
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [tyres, setTyres] = useState([blankTyre()]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function updateTyre(rowId, field, value) {
    setTyres((current) => current.map((tyre) =>
      tyre.rowId === rowId ? { ...tyre, [field]: value } : tyre,
    ));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const result = await savePurchase({
        vendorId: vendorMode === 'existing' ? vendorId : '',
        newVendorName: vendorMode === 'new' ? newVendorName : '',
        invoiceNumber,
        purchaseDate,
        price,
        brand,
        model,
        tyres,
      });
      onSaved(result.purchaseId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The purchase could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="form-panel" aria-labelledby="purchase-form-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Purchase Register</p>
          <h2 id="purchase-form-title">Add purchase</h2>
          <p>Purchase details and tyre registrations are saved together.</p>
        </div>
      </div>
      {error && <ErrorMessage title="Purchase not saved">{error}</ErrorMessage>}
      <form className="business-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="purchase-vendor">Vendor</label>
            {vendorMode === 'existing' ? (
              <select
                className="input select"
                id="purchase-vendor"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                required
              >
                <option value="">Select a vendor</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            ) : (
              <Input
                id="new-vendor-name"
                label="New vendor name"
                value={newVendorName}
                onChange={(event) => setNewVendorName(event.target.value)}
                required
              />
            )}
            {vendors.length > 0 && (
              <button
                className="inline-action"
                type="button"
                onClick={() => setVendorMode((mode) => mode === 'existing' ? 'new' : 'existing')}
              >
                {vendorMode === 'existing' ? 'Add a new vendor' : 'Choose an existing vendor'}
              </button>
            )}
          </div>
          <Input id="invoice-number" label="Invoice number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} required />
          <Input id="purchase-date" label="Purchase date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} required />
          <Input id="purchase-price" label="Price" type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required />
          <Input id="purchase-brand" label="Tyre brand" value={brand} onChange={(event) => setBrand(event.target.value)} required />
          <Input id="purchase-model" label="Tyre model" value={model} onChange={(event) => setModel(event.target.value)} required />
        </div>

        <section className="tyre-entry-section" aria-labelledby="purchase-tyres-title">
          <div className="section-heading form-section-heading">
            <div>
              <h3 id="purchase-tyres-title">Tyres in this purchase</h3>
              <p>Add each tyre serial number and initial NSD reading.</p>
            </div>
            <Button variant="secondary" onClick={() => setTyres((current) => [...current, blankTyre()])}>Add tyre</Button>
          </div>
          <div className="tyre-entry-list">
            {tyres.map((tyre, index) => (
              <div className="tyre-entry-row" key={tyre.rowId}>
                <span className="tyre-entry-number">{index + 1}</span>
                <Input
                  id={`purchase-tyre-serial-${tyre.rowId}`}
                  label="Serial number"
                  value={tyre.serialNumber}
                  onChange={(event) => updateTyre(tyre.rowId, 'serialNumber', event.target.value)}
                  required
                />
                <Input
                  id={`purchase-tyre-nsd-${tyre.rowId}`}
                  label="Initial NSD"
                  type="number"
                  min="0"
                  step="any"
                  value={tyre.initialNsd}
                  onChange={(event) => updateTyre(tyre.rowId, 'initialNsd', event.target.value)}
                  required
                />
                <button
                  className="remove-row-button"
                  type="button"
                  aria-label={`Remove tyre ${index + 1}`}
                  disabled={tyres.length === 1}
                  onClick={() => setTyres((current) => current.filter((item) => item.rowId !== tyre.rowId))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="form-actions">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving purchase…' : 'Save purchase and tyres'}</Button>
        </div>
      </form>
    </section>
  );
}
