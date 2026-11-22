import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { PageContainer } from '../../components/common/PageContainer.jsx';
import { loadTyreLifecycleHistory, searchTyreHistory } from '../../services/tyreHistoryService.js';
import { normalizeSerialNumber } from '../../data/database/recordUtils.js';

function BlobImage({ blob, alt, label }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!blob) return undefined;
    try {
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      setFailed(true);
      return undefined;
    }
  }, [blob]);
  if (!blob || failed) return <p className="muted-copy">{label} unavailable.</p>;
  return <figure className="history-photo"><img src={url} alt={alt} onError={() => setFailed(true)} /><figcaption>{label}</figcaption></figure>;
}

function eventTitle(event) {
  const labels = {
    TYRE_REGISTERED: 'Tyre registered',
    PURCHASE_ASSOCIATED: 'Purchase recorded',
    INSPECTION_RECORDED: 'Vehicle inspection',
    SCRAP_RECORDED: 'Tyre scrapped',
  };
  return labels[event.eventType] ?? event.eventType.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function TimelineEvent({ event }) {
  return (
    <article className="timeline-event">
      <div className="timeline-marker" aria-hidden="true" />
      <div className="timeline-card">
        <div className="timeline-heading"><h3>{eventTitle(event)}</h3><time dateTime={event.eventDate}>{event.eventDate}</time></div>
        {event.eventType === 'TYRE_REGISTERED' && <p>{event.details?.origin === 'existing-registration' ? 'Registered as an existing tyre.' : 'Registration recorded.'}</p>}
        {event.eventType === 'PURCHASE_ASSOCIATED' && (event.purchase ? <div className="timeline-facts"><p><strong>Invoice:</strong> {event.purchase.invoiceNumber}</p><p><strong>Vendor:</strong> {event.purchase.vendor?.name ?? 'Unavailable'}</p><p><strong>Brand / model:</strong> {event.purchase.brand} / {event.purchase.model || 'Not recorded'}</p><p><strong>Price:</strong> {event.purchase.price}</p></div> : <p>Purchase details are unavailable.</p>)}
        {event.eventType === 'INSPECTION_RECORDED' && <>
          <p><strong>Vehicle:</strong> {event.inspection?.vehicle?.registrationNumber ?? 'Unavailable'}{event.inspection?.vehicle?.description ? ` · ${event.inspection.vehicle.description}` : ''}</p>
          <p><strong>NSD:</strong> {event.entry?.nsd ?? event.details?.nsd ?? 'Not recorded'} · <strong>Brand:</strong> {event.entry?.brand ?? event.details?.brand ?? 'Not recorded'}</p>
          {event.entry?.photos?.length > 0 && <div className="history-photo-grid">{event.entry.photos.map((photo) => <BlobImage key={photo.id} blob={photo.blob} alt={`Inspection photo of tyre ${event.details?.serialNumber ?? ''}`} label={photo.fileName} />)}</div>}
        </>}
        {event.eventType === 'SCRAP_RECORDED' && (event.scrap ? <>
          <p><strong>Reason:</strong> {event.scrap.reason}</p>
          {event.scrap.remarks && <p><strong>Remarks:</strong> {event.scrap.remarks}</p>}
          <div className="history-photo-grid">
            <BlobImage blob={event.scrap.damagedPartPhoto?.blob} alt="Damaged tyre part" label="Damaged-part photo" />
            <BlobImage blob={event.scrap.completeTyrePhoto?.blob} alt="Complete scrapped tyre" label="Complete-tyre photo" />
          </div>
        </> : <p>Scrap details are unavailable.</p>)}
      </div>
    </article>
  );
}

export function TyreHistoryPage() {
  const [searchParams] = useSearchParams();
  const directSerial = searchParams.get('serial') ?? '';
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const openHistory = useCallback(async (serialNumber) => {
    setError('');
    setIsLoadingHistory(true);
    try {
      const result = await loadTyreLifecycleHistory(serialNumber);
      if (!result) throw new Error(`No tyre is registered with serial number ${serialNumber}.`);
      setHistory(result);
    } catch (loadError) {
      setHistory(null);
      setError(loadError instanceof Error ? loadError.message : 'Tyre history could not be loaded.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!directSerial) return;
    setQuery(directSerial);
    void openHistory(directSerial);
  }, [directSerial, openHistory]);

  async function handleSearch(event) {
    event.preventDefault();
    setError('');
    setHistory(null);
    setIsSearching(true);
    try {
      const result = await searchTyreHistory(query);
      setMatches(result);
      if (result.length === 1 && normalizeSerialNumber(query) === normalizeSerialNumber(result[0].serialNumber)) {
        setQuery(result[0].serialNumber);
        await openHistory(result[0].serialNumber);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Tyre search failed.');
      setMatches([]);
    } finally {
      setIsSearching(false);
    }
  }

  const latestInspection = [...(history?.timeline ?? [])].reverse().find((event) => event.eventType === 'INSPECTION_RECORDED');

  return (
    <>
      <PageContainer eyebrow="Business module" title="Tyre History" description="Search by a tyre’s serial number to review its recorded lifecycle in date order." />
      <form className="history-search" onSubmit={handleSearch}>
        <Input id="tyre-history-search" label="Tyre serial number" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter all or part of a serial number" required />
        <Button type="submit" disabled={isSearching}>{isSearching ? 'Searching…' : 'Search tyres'}</Button>
      </form>
      {error && <ErrorMessage title="Tyre history unavailable">{error}</ErrorMessage>}
      {isSearching && <LoadingState label="Searching registered tyres" />}
      {!isSearching && matches.length > 0 && !history && <section className="history-matches" aria-label="Matching tyres"><h2>Matching tyres</h2>{matches.map((tyre) => <button type="button" className="history-match" key={tyre.id} onClick={() => { setQuery(tyre.serialNumber); void openHistory(tyre.serialNumber); }}><span><strong>{tyre.serialNumber}</strong><small>{tyre.brand}{tyre.model ? ` · ${tyre.model}` : ''}</small></span><span>View history</span></button>)}</section>}
      {!isSearching && !isLoadingHistory && query && matches.length === 0 && !history && !error && <EmptyState title="No matching tyres" description="Check the serial number or register this tyre through the Purchase Register." />}
      {isLoadingHistory && <LoadingState label="Loading tyre lifecycle history" />}
      {history && !isLoadingHistory && <>
        <section className="details-panel tyre-overview" aria-labelledby="tyre-overview-title">
          <div className="section-heading"><div><p className="eyebrow">Tyre overview</p><h2 id="tyre-overview-title">{history.tyre.serialNumber}</h2></div><span className={`status-badge${history.tyre.currentStatus === 'scrapped' ? ' status-badge-scrapped' : ''}`}>{history.tyre.currentStatus ?? 'Status unavailable'}</span></div>
          <dl className="details-grid">
            <div><dt>Brand</dt><dd>{history.tyre.brand || 'Not recorded'}</dd></div><div><dt>Model</dt><dd>{history.tyre.model || 'Not recorded'}</dd></div>
            <div><dt>Initial NSD</dt><dd>{history.tyre.initialNsd ?? 'Not recorded'}</dd></div><div><dt>Current recorded NSD</dt><dd>{history.currentNsd ?? 'Not recorded'}</dd></div>
            <div><dt>Registration date</dt><dd>{history.tyre.registrationDate ?? 'Not recorded'}</dd></div><div><dt>Purchase</dt><dd>{history.purchase ? history.purchase.invoiceNumber : 'No purchase associated'}</dd></div>
            <div><dt>Client</dt><dd>{history.client?.name ?? 'Not recorded'}</dd></div><div><dt>Site</dt><dd>{history.site?.name ?? 'Not recorded'}</dd></div><div><dt>Vehicle</dt><dd>{history.vehicle?.registrationNumber ?? 'Not recorded'}</dd></div>
          </dl>
        </section>
        {latestInspection && <p className="muted-copy">Current recorded NSD is from the latest saved inspection on {latestInspection.eventDate}; earlier readings remain in the timeline.</p>}
        <section className="dashboard-section" aria-labelledby="tyre-timeline-title"><div className="section-heading"><div><h2 id="tyre-timeline-title">Chronological history</h2><p>{history.timeline.length} recorded {history.timeline.length === 1 ? 'event' : 'events'} · oldest first</p></div></div>
          {history.timeline.length ? <div className="tyre-timeline">{history.timeline.map((event) => <TimelineEvent event={event} key={event.id} />)}</div> : <EmptyState title="No history events" description="No lifecycle events are currently recorded for this tyre." />}
        </section>
      </>}
      {!query && !history && !error && !isSearching && <EmptyState title="Search for a tyre" description="Enter a serial number or a partial serial number to find its registration, purchase, inspection and scrap records." />}
    </>
  );
}
