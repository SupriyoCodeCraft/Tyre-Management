import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { lookupInspectionTyre, saveVehicleInspection } from '../../services/inspectionService.js';
import { validateInspectionImage } from '../../services/inspectionImageService.js';
import { createId } from '../../data/database/recordUtils.js';

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function blankEntry() {
  return { id: createId(), serialNumber: '', tyre: null, nsd: '', photos: [], lookupError: '', photoError: '', isLookingUp: false };
}

function releasePreview(previewUrls, photo) {
  URL.revokeObjectURL(photo.previewUrl);
  previewUrls.current.delete(photo.previewUrl);
}

export function InspectionForm({ records, onCancel, onSaved }) {
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [inspectionDate, setInspectionDate] = useState(todayDate);
  const [entries, setEntries] = useState([blankEntry()]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const previewUrls = useRef(new Set());
  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
  }, []);
  const sites = useMemo(() => records.sites.filter((site) => site.clientId === clientId), [clientId, records.sites]);
  const vehicles = useMemo(() => records.vehicles.filter((vehicle) => vehicle.siteId === siteId && vehicle.clientId === clientId), [clientId, records.vehicles, siteId]);

  function updateEntry(entryId, changes) {
    setEntries((current) => current.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  }

  async function resolveSerial(entry) {
    const serialNumber = entry.serialNumber.trim();
    if (!serialNumber) {
      updateEntry(entry.id, { tyre: null, lookupError: '' });
      return;
    }
    updateEntry(entry.id, { isLookingUp: true, lookupError: '', tyre: null });
    try {
      const tyre = await lookupInspectionTyre(serialNumber);
      updateEntry(entry.id, {
        tyre,
        serialNumber: tyre?.serialNumber ?? serialNumber,
        lookupError: tyre ? '' : `Tyre ${serialNumber} is not registered. Register it through Purchase Register → Register existing tyre.`,
        isLookingUp: false,
      });
    } catch (lookupError) {
      updateEntry(entry.id, { lookupError: lookupError instanceof Error ? lookupError.message : 'Could not look up this tyre.', isLookingUp: false });
    }
  }

  function addPhotos(entry, files) {
    const nextPhotos = [...entry.photos];
    let photoError = '';
    for (const file of files) {
      try {
        validateInspectionImage(file);
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.add(previewUrl);
        nextPhotos.push({ file, previewUrl });
      } catch (validationError) {
        photoError = validationError instanceof Error ? validationError.message : 'This image cannot be used.';
      }
    }
    updateEntry(entry.id, { photos: nextPhotos, photoError });
  }

  function removePhoto(entry, photo) {
    releasePreview(previewUrls, photo);
    updateEntry(entry.id, { photos: entry.photos.filter((item) => item !== photo) });
  }

  function removeEntry(entryId) {
    const entry = entries.find((item) => item.id === entryId);
    entry?.photos.forEach((photo) => releasePreview(previewUrls, photo));
    setEntries((current) => current.filter((item) => item.id !== entryId));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const result = await saveVehicleInspection({
        clientId, siteId, vehicleId, inspectionDate,
        entries: entries.map((entry) => ({ serialNumber: entry.serialNumber, nsd: entry.nsd, photos: entry.photos.map((photo) => photo.file) })),
      });
      await onSaved(result.session.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The inspection could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  const selectedVehicle = records.vehicles.find((vehicle) => vehicle.id === vehicleId);

  return (
    <section className="form-panel" aria-labelledby="inspection-form-title">
      <div className="panel-heading"><p className="eyebrow">Vehicle Live Inspection</p><h2 id="inspection-form-title">New inspection</h2><p>Each inspection is saved as a separate historical session for one vehicle.</p></div>
      {error && <ErrorMessage title="Inspection not saved">{error}</ErrorMessage>}
      <form className="business-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field"><label className="field-label" htmlFor="inspection-client">Client</label><select className="input select" id="inspection-client" value={clientId} onChange={(event) => { setClientId(event.target.value); setSiteId(''); setVehicleId(''); }} required><option value="">Select client</option>{records.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="inspection-site">Site</label><select className="input select" id="inspection-site" value={siteId} onChange={(event) => { setSiteId(event.target.value); setVehicleId(''); }} required disabled={!clientId}><option value="">Select site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="inspection-vehicle">Vehicle</label><select className="input select" id="inspection-vehicle" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required disabled={!siteId}><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}{vehicle.description ? ` · ${vehicle.description}` : ''}</option>)}</select></div>
          <Input id="inspection-date" label="Inspection date" type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} required />
        </div>
        {selectedVehicle && <p className="inspection-selected-vehicle">Selected vehicle: <strong>{selectedVehicle.registrationNumber}</strong>{selectedVehicle.description ? ` · ${selectedVehicle.description}` : ''}</p>}
        <section className="tyre-entry-section" aria-labelledby="inspection-tyres-heading">
          <div className="section-heading form-section-heading"><div><h3 id="inspection-tyres-heading">Tyres inspected</h3><p>Use each tyre’s registered serial number. NSD accepts zero under the current nonnegative validation policy.</p></div><Button variant="secondary" onClick={() => setEntries((current) => [...current, blankEntry()])}>Add tyre</Button></div>
          <div className="tyre-entry-list">
            {entries.map((entry, index) => (
              <article className="inspection-entry" key={entry.id}>
                <div className="inspection-entry-heading"><strong>Tyre {index + 1}</strong><button className="remove-row-button" type="button" disabled={entries.length === 1} onClick={() => removeEntry(entry.id)}>Remove tyre</button></div>
                <div className="form-grid">
                  <Input id={`inspection-serial-${entry.id}`} label="Registered tyre serial number" value={entry.serialNumber} onChange={(event) => updateEntry(entry.id, { serialNumber: event.target.value, tyre: null, lookupError: '' })} onBlur={() => resolveSerial(entry)} required aria-describedby={entry.lookupError ? `inspection-serial-error-${entry.id}` : undefined} />
                  <Input id={`inspection-brand-${entry.id}`} label="Brand" value={entry.tyre?.brand ?? ''} readOnly required hint={entry.tyre ? 'Loaded from the registered tyre record.' : 'Enter a registered serial number to load its brand.'} />
                  <Input id={`inspection-nsd-${entry.id}`} label="NSD / tread depth" type="number" min="0" step="any" value={entry.nsd} onChange={(event) => updateEntry(entry.id, { nsd: event.target.value })} required />
                  <div className="field"><label className="field-label" htmlFor={`inspection-photos-${entry.id}`}>Inspection photographs</label><input className="input" id={`inspection-photos-${entry.id}`} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addPhotos(entry, [...event.target.files]); event.target.value = ''; }} /><p className="field-hint">JPEG, PNG or WebP; up to 15 MB each. Photos are resized before saving.</p></div>
                </div>
                {entry.isLookingUp && <p className="field-hint" role="status">Checking registered tyre…</p>}
                {entry.lookupError && <p className="field-error" id={`inspection-serial-error-${entry.id}`} role="alert">{entry.lookupError}</p>}
                {entry.photoError && <p className="field-error" role="alert">{entry.photoError}</p>}
                {entry.tyre && <p className="registered-tyre-note" role="status">Matched registered tyre: {entry.tyre.serialNumber}</p>}
                {!!entry.photos.length && <div className="inspection-photo-grid">{entry.photos.map((photo) => <div className="inspection-photo" key={photo.previewUrl}><img src={photo.previewUrl} alt={`Preview of ${photo.file.name}`} /><span>{photo.file.name}</span><button type="button" aria-label={`Remove ${photo.file.name}`} onClick={() => removePhoto(entry, photo)}>Remove photo</button></div>)}</div>}
              </article>
            ))}
          </div>
        </section>
        <div className="form-actions"><Button variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button><Button type="submit" disabled={isSaving || entries.some((entry) => entry.isLookingUp)}>{isSaving ? 'Saving inspection…' : 'Save inspection'}</Button></div>
      </form>
    </section>
  );
}
