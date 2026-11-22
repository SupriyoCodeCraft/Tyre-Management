import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { routePaths } from '../../app/routePaths.js';
import { loadScrapDetails } from '../../services/scrapService.js';

function StoredScrapPhoto({ photo, title }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!photo?.blob) return undefined;
    try {
      const objectUrl = URL.createObjectURL(photo.blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      setFailed(true);
      return undefined;
    }
  }, [photo]);
  return <figure className="scrap-detail-photo"><h3>{title}</h3>{photo?.blob && !failed ? <img src={url} alt={title} onError={() => setFailed(true)} /> : <p className="muted-copy">Photograph unavailable.</p>}{photo?.fileName && <figcaption>{photo.fileName}</figcaption>}</figure>;
}

export function ScrapDetails({ recordId, onBack }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadScrapDetails(recordId).then((result) => { if (active) setRecord(result); })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : 'Could not load this scrap record.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [recordId]);
  if (loading) return <LoadingState label="Loading scrap record" />;
  if (error) return <ErrorMessage title="Scrap record unavailable">{error}</ErrorMessage>;
  if (!record) return <ErrorMessage title="Scrap record not found">This record is unavailable in local storage.</ErrorMessage>;

  return <>
    <div className="page-container"><div className="page-heading"><div><p className="eyebrow">Scrap record</p><h1>{record.serialNumber}</h1><p className="page-description">Recorded {record.scrapDate} · {record.reason}</p></div><Button variant="secondary" onClick={onBack}>Back to Scrap Analysis</Button></div></div>
    <section className="details-panel"><dl className="details-grid">
      <div><dt>Brand</dt><dd>{record.brand || 'Not recorded'}</dd></div><div><dt>Model</dt><dd>{record.model || 'Not recorded'}</dd></div>
      <div><dt>Client</dt><dd>{record.client?.name ?? 'Not recorded'}</dd></div><div><dt>Site</dt><dd>{record.site?.name ?? 'Not recorded'}</dd></div>
      <div><dt>Vehicle</dt><dd>{record.vehicle?.registrationNumber ?? 'Not recorded'}</dd></div><div><dt>Status</dt><dd>Scrapped</dd></div>
      <div><dt>Remarks</dt><dd>{record.remarks || 'None'}</dd></div>
    </dl><Link className="text-link" to={`${routePaths.tyreHistory}?serial=${encodeURIComponent(record.serialNumber)}`}>Open this tyre’s full history</Link></section>
    <section className="dashboard-section"><div className="section-heading"><div><h2>Scrap photographs</h2><p>Stored with this record in browser IndexedDB.</p></div></div><div className="scrap-photo-gallery"><StoredScrapPhoto photo={record.damagedPartPhoto} title="Damaged-part photograph" /><StoredScrapPhoto photo={record.completeTyrePhoto} title="Complete-tyre photograph" /></div></section>
  </>;
}
