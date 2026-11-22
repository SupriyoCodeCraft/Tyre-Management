import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { loadTyreRegistrationOptions, registerExistingTyre } from '../../services/tyreService.js';

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function ExistingTyreForm({ onCancel, onSaved }) {
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [initialNsd, setInitialNsd] = useState('');
  const [registrationDate, setRegistrationDate] = useState(todayDate);
  const [currentClientId, setCurrentClientId] = useState('');
  const [currentSiteId, setCurrentSiteId] = useState('');
  const [currentVehicleId, setCurrentVehicleId] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTyreRegistrationOptions()
      .then((options) => {
        setClients(options.clients);
        setSites(options.sites);
        setVehicles(options.vehicles);
      })
      .catch((loadFailure) => {
        setLoadError(loadFailure instanceof Error ? loadFailure.message : 'Could not load client, site, and vehicle options.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const availableSites = useMemo(
    () => currentClientId ? sites.filter((site) => site.clientId === currentClientId) : sites,
    [currentClientId, sites],
  );
  const availableVehicles = useMemo(() => vehicles.filter((vehicle) =>
    (!currentClientId || vehicle.clientId === currentClientId) &&
    (!currentSiteId || vehicle.siteId === currentSiteId),
  ), [currentClientId, currentSiteId, vehicles]);

  function changeClient(clientId) {
    setCurrentClientId(clientId);
    setCurrentSiteId('');
    setCurrentVehicleId('');
  }

  function changeSite(siteId) {
    setCurrentSiteId(siteId);
    setCurrentVehicleId('');
    const site = sites.find((item) => item.id === siteId);
    if (site) setCurrentClientId(site.clientId);
  }

  function changeVehicle(vehicleId) {
    setCurrentVehicleId(vehicleId);
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (vehicle) {
      setCurrentClientId(vehicle.clientId);
      setCurrentSiteId(vehicle.siteId);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const tyre = await registerExistingTyre({
        serialNumber,
        brand,
        model,
        initialNsd,
        registrationDate,
        currentClientId,
        currentSiteId,
        currentVehicleId,
      });
      onSaved(tyre);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The tyre could not be registered.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="form-panel" aria-labelledby="existing-tyre-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Tyre registration</p>
          <h2 id="existing-tyre-title">Register an existing tyre</h2>
          <p>Record a tyre already in use or on hand without linking it to a purchase.</p>
        </div>
      </div>
      {loadError && <ErrorMessage title="Options unavailable">{loadError}</ErrorMessage>}
      {error && <ErrorMessage title="Tyre not registered">{error}</ErrorMessage>}
      {isLoading ? <LoadingState label="Loading client and vehicle options" /> : (
        <form className="business-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <Input id="existing-serial" label="Serial number" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} required />
            <Input id="existing-brand" label="Brand" value={brand} onChange={(event) => setBrand(event.target.value)} required />
            <Input id="existing-model" label="Model (optional)" value={model} onChange={(event) => setModel(event.target.value)} />
            <Input id="existing-nsd" label="Initial NSD" type="number" min="0" step="any" value={initialNsd} onChange={(event) => setInitialNsd(event.target.value)} required />
            <Input id="existing-registration-date" label="Registration date" type="date" value={registrationDate} onChange={(event) => setRegistrationDate(event.target.value)} required />
            <div className="field">
              <label className="field-label" htmlFor="existing-client">Client (optional)</label>
              <select className="input select" id="existing-client" value={currentClientId} onChange={(event) => changeClient(event.target.value)}>
                <option value="">No client association</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="existing-site">Site (optional)</label>
              <select className="input select" id="existing-site" value={currentSiteId} onChange={(event) => changeSite(event.target.value)}>
                <option value="">No site association</option>
                {availableSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="existing-vehicle">Vehicle (optional)</label>
              <select className="input select" id="existing-vehicle" value={currentVehicleId} onChange={(event) => changeVehicle(event.target.value)}>
                <option value="">No vehicle association</option>
                {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Registering tyre…' : 'Register tyre'}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
