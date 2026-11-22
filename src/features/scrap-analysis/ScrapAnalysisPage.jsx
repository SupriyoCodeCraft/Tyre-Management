import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { PageContainer } from '../../components/common/PageContainer.jsx';
import { loadScrapAnalysis } from '../../services/scrapService.js';
import { ScrapDetails } from './ScrapDetails.jsx';
import { ScrapForm } from './ScrapForm.jsx';

function Distribution({ title, items, emptyLabel }) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return <section className="analysis-card"><h3>{title}</h3>{items.length ? <ul className="distribution-list">{items.map((item) => <li key={item.label}><div className="distribution-label"><span>{item.label}</span><strong>{item.count}</strong></div><div className="distribution-track"><span style={{ width: `${Math.max(5, item.count / maximum * 100)}%` }} /></div></li>)}</ul> : <p className="muted-copy">{emptyLabel}</p>}</section>;
}

export function ScrapAnalysisPage() {
  const [analysis, setAnalysis] = useState({ records: [], total: 0, byReason: [], byBrand: [], byMonth: [] });
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError('');
    try { setAnalysis(await loadScrapAnalysis()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Scrap Analysis could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const clients = useMemo(() => [...new Map(analysis.records.filter((record) => record.client).map((record) => [record.client.id, record.client])).values()], [analysis.records]);
  const sites = useMemo(() => [...new Map(analysis.records.filter((record) => record.site && (!clientId || record.site.clientId === clientId)).map((record) => [record.site.id, record.site])).values()], [analysis.records, clientId]);
  const reasons = useMemo(() => [...new Set(analysis.records.map((record) => record.reason))].sort((a, b) => a.localeCompare(b)), [analysis.records]);
  const filteredRecords = useMemo(() => analysis.records.filter((record) => {
    const query = search.trim().toLocaleLowerCase();
    return (!query || [record.serialNumber, record.brand, record.model, record.vehicle?.registrationNumber].some((value) => String(value ?? '').toLocaleLowerCase().includes(query)))
      && (!reason || record.reason === reason)
      && (!clientId || record.clientId === clientId)
      && (!siteId || record.siteId === siteId)
      && (!fromDate || record.scrapDate >= fromDate)
      && (!toDate || record.scrapDate <= toDate);
  }), [analysis.records, search, reason, clientId, siteId, fromDate, toDate]);

  async function handleSaved(id) {
    setNotice('Scrap record saved. Tyre status and history were updated.');
    setView('details');
    setSelectedId(id);
    await refresh();
  }
  if (view === 'details') return <>{notice && <div className="success-message" role="status">{notice}</div>}<ScrapDetails recordId={selectedId} onBack={() => { setView('list'); void refresh(); }} /></>;

  return <>
    <PageContainer eyebrow="Business module" title="Scrap Analysis" description="Record end-of-life tyres with photo evidence and review actual scrap records and trends.">
      {view === 'list' && <div className="page-actions"><Button onClick={() => { setNotice(''); setView('create'); }}>Record scrapped tyre</Button></div>}
      {view === 'create' && <Button variant="secondary" onClick={() => setView('list')}>Back to Scrap Analysis</Button>}
    </PageContainer>
    {notice && <div className="success-message" role="status">{notice}</div>}
    {error && <ErrorMessage title="Scrap Analysis unavailable">{error}</ErrorMessage>}
    {loading ? <LoadingState label="Loading scrap records" /> : view === 'create' ? <ScrapForm onCancel={() => setView('list')} onSaved={handleSaved} /> : <>
      <section className="scrap-overview" aria-label="Scrap totals"><div className="scrap-total-card"><span>Total scrapped tyres</span><strong>{analysis.total}</strong></div><Distribution title="Scrap by reason" items={analysis.byReason} emptyLabel="No scrap reasons recorded." /><Distribution title="Scrap by brand" items={analysis.byBrand} emptyLabel="No brand data recorded." /><Distribution title="Scrap over time" items={analysis.byMonth} emptyLabel="No monthly data recorded." /></section>
      <section className="scrap-register" aria-labelledby="scrap-register-title"><div className="section-heading"><div><h2 id="scrap-register-title">Recorded scrap cases</h2><p>Search and filter the saved records.</p></div></div>
        <div className="scrap-filters">
          <Input id="scrap-search" label="Search serial / tyre" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Serial number, brand, model, vehicle" />
          <div className="field"><label className="field-label" htmlFor="scrap-reason-filter">Reason</label><select className="input select" id="scrap-reason-filter" value={reason} onChange={(event) => setReason(event.target.value)}><option value="">All reasons</option>{reasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="scrap-client-filter">Client</label><select className="input select" id="scrap-client-filter" value={clientId} onChange={(event) => { setClientId(event.target.value); setSiteId(''); }}><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="scrap-site-filter">Site</label><select className="input select" id="scrap-site-filter" value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">All sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
          <Input id="scrap-from-date" label="From date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input id="scrap-to-date" label="To date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <span className="result-count">{filteredRecords.length} {filteredRecords.length === 1 ? 'case' : 'cases'}</span>
        </div>
        {!filteredRecords.length ? <EmptyState title={analysis.total ? 'No matching scrap cases' : 'No scrap records yet'} description={analysis.total ? 'Change or clear the filters to see other recorded cases.' : 'Record a scrapped tyre to begin Scrap Analysis.'} /> : <div className="table-wrap responsive-table-wrap"><table className="data-table responsive-table"><thead><tr><th>Serial</th><th>Brand / model</th><th>Scrap date</th><th>Reason</th><th>Client / site / vehicle</th><th>Photos</th><th>Details</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id}><td data-label="Serial">{record.serialNumber}</td><td data-label="Brand / model">{record.brand}{record.model ? ` · ${record.model}` : ''}</td><td data-label="Scrap date">{record.scrapDate}</td><td data-label="Reason">{record.reason}</td><td data-label="Client / site / vehicle">{[record.client?.name, record.site?.name, record.vehicle?.registrationNumber].filter(Boolean).join(' · ') || 'Not recorded'}</td><td data-label="Photos">{record.damagedPartPhotoId ? 'Damaged part' : ''}{record.damagedPartPhotoId && record.completeTyrePhotoId ? ' + ' : ''}{record.completeTyrePhotoId ? 'Complete tyre' : ''}</td><td data-label="Details"><button type="button" className="table-link" onClick={() => { setNotice(''); setSelectedId(record.id); setView('details'); }}>Open record</button></td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </>;
}
