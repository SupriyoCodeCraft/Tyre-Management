import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { lookupScrapTyre, saveScrap } from '../../services/scrapService.js';
import { validateInspectionImage } from '../../services/inspectionImageService.js';

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function ScrapForm({ onCancel, onSaved }) {
  const [serialNumber, setSerialNumber] = useState('');
  const [tyre, setTyre] = useState(null);
  const [scrapDate, setScrapDate] = useState(todayDate);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [damagedPartPhoto, setDamagedPartPhoto] = useState(null);
  const [completeTyrePhoto, setCompleteTyrePhoto] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [error, setError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const urls = useRef(new Set());

  useEffect(() => () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);

  async function resolveTyre() {
    if (!serialNumber.trim()) { setTyre(null); setLookupError(''); return; }
    setIsLookingUp(true); setLookupError(''); setTyre(null);
    try {
      const matched = await lookupScrapTyre(serialNumber);
      if (!matched) setLookupError(`Tyre ${serialNumber.trim()} is not registered. Register it through Purchase Register → Register existing tyre.`);
      else { setTyre(matched); setSerialNumber(matched.serialNumber); }
    } catch (lookupFailure) {
      setLookupError(lookupFailure instanceof Error ? lookupFailure.message : 'Could not look up the tyre.');
    } finally { setIsLookingUp(false); }
  }

  function selectPhoto(setter, currentPhoto, file) {
    if (!file) return;
    try {
      validateInspectionImage(file);
      if (currentPhoto) { URL.revokeObjectURL(currentPhoto.previewUrl); urls.current.delete(currentPhoto.previewUrl); }
      const previewUrl = URL.createObjectURL(file);
      urls.current.add(previewUrl);
      setter({ file, previewUrl });
      setError('');
    } catch (validationFailure) {
      setError(validationFailure instanceof Error ? validationFailure.message : 'The photograph is not valid.');
    }
  }

  function removePhoto(setter, photo) {
    if (photo) { URL.revokeObjectURL(photo.previewUrl); urls.current.delete(photo.previewUrl); }
    setter(null);
  }

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setIsSaving(true);
    try {
      const record = await saveScrap({
        serialNumber, scrapDate, reason, remarks,
        damagedPartPhoto: damagedPartPhoto?.file,
        completeTyrePhoto: completeTyrePhoto?.file,
      });
      await onSaved(record.id);
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : 'The scrap record could not be saved.');
    } finally { setIsSaving(false); }
  }

  return (
    <section className="form-panel" aria-labelledby="scrap-form-title">
      <div className="panel-heading"><p className="eyebrow">Scrap Analysis</p><h2 id="scrap-form-title">Record scrapped tyre</h2><p>The tyre status, scrap record, photographs and history event are saved together.</p></div>
      {error && <ErrorMessage title="Scrap record not saved">{error}</ErrorMessage>}
      {lookupError && <ErrorMessage title="Tyre unavailable">{lookupError}</ErrorMessage>}
      <form className="business-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Input id="scrap-serial" label="Registered tyre serial number" value={serialNumber} onChange={(event) => { setSerialNumber(event.target.value); setTyre(null); setLookupError(''); }} onBlur={resolveTyre} required />
          <Input id="scrap-brand" label="Brand" value={tyre?.brand ?? ''} readOnly hint="Loaded from the registered tyre record." />
          <Input id="scrap-model" label="Model" value={tyre?.model ?? ''} readOnly hint="Loaded from the registered tyre record." />
          <Input id="scrap-date" label="Scrap date" type="date" value={scrapDate} onChange={(event) => setScrapDate(event.target.value)} required />
          <Input id="scrap-reason" label="Scrap reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
          <Input id="scrap-remarks" label="Remarks (optional)" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </div>
        <div className="scrap-photo-fields">
          {[['damaged-part', 'Damaged-part photograph', damagedPartPhoto, setDamagedPartPhoto], ['complete-tyre', 'Complete-tyre photograph', completeTyrePhoto, setCompleteTyrePhoto]].map(([key, label, photo, setter]) => (
            <div className="scrap-photo-upload" key={key}>
              <Input id={`scrap-photo-${key}`} label={label} type="file" accept="image/jpeg,image/png,image/webp" required={!photo} onChange={(event) => { selectPhoto(setter, photo, event.target.files?.[0]); event.target.value = ''; }} hint="JPEG, PNG or WebP up to 15 MB. Resized and compressed before saving." />
              {photo && <div className="scrap-preview"><img src={photo.previewUrl} alt={`${label} preview`} /><div><strong>{photo.file.name}</strong><button className="inline-action" type="button" onClick={() => removePhoto(setter, photo)}>Remove photo</button></div></div>}
            </div>
          ))}
        </div>
        {isLookingUp && <p className="field-hint" role="status">Looking up registered tyre…</p>}
        {tyre && <p className="registered-tyre-note" role="status">Registered tyre confirmed: {tyre.serialNumber}</p>}
        <div className="form-actions"><Button variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button><Button type="submit" disabled={isSaving || isLookingUp}>{isSaving ? 'Saving scrap record…' : 'Record scrap'}</Button></div>
      </form>
    </section>
  );
}
