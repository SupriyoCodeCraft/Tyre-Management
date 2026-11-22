import { useMemo, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { addClient, addSite, addVehicle } from '../../services/inspectionService.js';

export function InspectionRecords({ records, onRefresh, onBack }) {
  const [kind, setKind] = useState('client');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const sites = useMemo(() => records.sites.filter((site) => site.clientId === clientId), [clientId, records.sites]);
  const vehicles = useMemo(() => records.vehicles.filter((vehicle) => vehicle.siteId === siteId), [siteId, records.vehicles]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      if (kind === 'client') await addClient({ name });
      if (kind === 'site') await addSite({ clientId, name, location });
      if (kind === 'vehicle') await addVehicle({ clientId, siteId, registrationNumber, description });
      setName(''); setLocation(''); setRegistrationNumber(''); setDescription('');
      await onRefresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The record could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="form-panel inspection-records" aria-labelledby="inspection-records-title">
      <div className="section-heading">
        <div><h2 id="inspection-records-title">Clients, sites and vehicles</h2><p>Set up the records needed to start an inspection.</p></div>
        <Button variant="secondary" onClick={onBack}>Back to inspections</Button>
      </div>
      <div className="inspection-tabs" role="tablist" aria-label="Record type">
        {[['client', 'Clients'], ['site', 'Sites'], ['vehicle', 'Vehicles']].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={kind === value} className={kind === value ? 'inspection-tab inspection-tab-active' : 'inspection-tab'} onClick={() => { setKind(value); setError(''); }}>{label}</button>
        ))}
      </div>
      {error && <ErrorMessage title="Record not saved">{error}</ErrorMessage>}
      <form className="business-form" onSubmit={handleSubmit}>
        {kind !== 'vehicle' && <Input id="record-name" label={kind === 'client' ? 'Client / business name' : 'Site name'} value={name} onChange={(event) => setName(event.target.value)} required />}
        {kind === 'site' && <>
          <div className="field"><label className="field-label" htmlFor="record-client-site">Client</label><select className="input select" id="record-client-site" value={clientId} onChange={(event) => setClientId(event.target.value)} required><option value="">Select client</option>{records.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <Input id="record-location" label="Location / address (optional)" value={location} onChange={(event) => setLocation(event.target.value)} />
        </>}
        {kind === 'vehicle' && <>
          <div className="field"><label className="field-label" htmlFor="record-client-vehicle">Client</label><select className="input select" id="record-client-vehicle" value={clientId} onChange={(event) => { setClientId(event.target.value); setSiteId(''); }} required><option value="">Select client</option>{records.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="record-site-vehicle">Site</label><select className="input select" id="record-site-vehicle" value={siteId} onChange={(event) => setSiteId(event.target.value)} required disabled={!clientId}><option value="">Select site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
          <Input id="record-registration" label="Vehicle registration / identifier" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} required />
          <Input id="record-description" label="Description (optional)" value={description} onChange={(event) => setDescription(event.target.value)} />
        </>}
        <div className="form-actions"><Button type="submit" disabled={isSaving || (kind !== 'client' && records.clients.length === 0) || (kind === 'vehicle' && sites.length === 0)}>{isSaving ? 'Saving…' : `Add ${kind}`}</Button></div>
      </form>
      <div className="dashboard-section">
        <div className="section-heading"><div><h3>{kind === 'client' ? 'Existing clients' : kind === 'site' ? 'Sites for selected client' : 'Vehicles at selected site'}</h3></div></div>
        {kind === 'client' && records.clients.map((client) => <p className="record-line" key={client.id}>{client.name}</p>)}
        {kind === 'site' && (clientId ? sites : []).map((site) => <p className="record-line" key={site.id}>{site.name}{site.location ? ` · ${site.location}` : ''}</p>)}
        {kind === 'vehicle' && (siteId ? vehicles : []).map((vehicle) => <p className="record-line" key={vehicle.id}><strong>{vehicle.registrationNumber}</strong>{vehicle.description ? ` · ${vehicle.description}` : ''}</p>)}
        {((kind === 'client' && !records.clients.length) || (kind === 'site' && clientId && !sites.length) || (kind === 'vehicle' && siteId && !vehicles.length)) && <p className="muted-copy">No records to show yet.</p>}
      </div>
    </section>
  );
}
