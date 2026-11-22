import { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { loadInspectionDetails } from '../../services/inspectionService.js';

export function InspectionDetails({ sessionId, onBack }) {
  const [inspection, setInspection] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let urls = [];
    loadInspectionDetails(sessionId)
      .then((record) => {
        if (!active || !record) return;
        record.entries.forEach((entry) => entry.photos.forEach((photo) => {
          photo.previewUrl = URL.createObjectURL(photo.blob);
          urls.push(photo.previewUrl);
        }));
        setInspection(record);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load inspection details.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sessionId]);

  if (isLoading) return <LoadingState label="Loading inspection details" />;
  if (error) return <ErrorMessage title="Inspection unavailable">{error}</ErrorMessage>;
  if (!inspection) return <ErrorMessage title="Inspection not found">This session is not available in local storage.</ErrorMessage>;

  return (
    <>
      <div className="page-container"><div className="page-heading"><div><p className="eyebrow">Inspection details</p><h1>{inspection.vehicle?.registrationNumber ?? 'Vehicle inspection'}</h1><p className="page-description">Inspection date: {inspection.inspectionDate}{inspection.vehicle?.description ? ` · ${inspection.vehicle.description}` : ''}</p></div><Button variant="secondary" onClick={onBack}>Back to history</Button></div></div>
      <div className="inspection-detail-list">
        {inspection.entries.map((entry) => <article className="details-panel inspection-detail-entry" key={entry.id}>
          <div className="section-heading"><div><h2>{entry.serialNumber}</h2><p>{entry.brand} · NSD {entry.nsd}</p></div></div>
          {entry.photos.length ? <div className="inspection-photo-grid stored-photo-grid">{entry.photos.map((photo) => <figure className="inspection-photo" key={photo.id}><img src={photo.previewUrl} alt={`Inspection photo of tyre ${entry.serialNumber}`} /><figcaption>{photo.fileName}</figcaption></figure>)}</div> : <p className="muted-copy">No photographs were attached to this tyre entry.</p>}
        </article>)}
      </div>
    </>
  );
}
