import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { PageContainer } from '../../components/common/PageContainer.jsx';
import { loadInspectionHistory, loadInspectionRecords } from '../../services/inspectionService.js';
import { InspectionDetails } from './InspectionDetails.jsx';
import { InspectionForm } from './InspectionForm.jsx';
import { InspectionHistory } from './InspectionHistory.jsx';
import { InspectionRecords } from './InspectionRecords.jsx';

export function InspectionPage() {
  const [records, setRecords] = useState({ clients: [], sites: [], vehicles: [] });
  const [sessions, setSessions] = useState([]);
  const [view, setView] = useState('history');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [recordOptions, inspectionRecords] = await Promise.all([loadInspectionRecords(), loadInspectionHistory()]);
      setRecords(recordOptions);
      setSessions(inspectionRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The inspection workspace could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleSaved() {
    setView('history');
    setNotice('Inspection saved with its tyre readings, photographs and history entries.');
    await refresh();
  }

  if (view === 'details') {
    return <InspectionDetails sessionId={selectedSessionId} onBack={() => setView('history')} />;
  }

  return (
    <>
      <PageContainer eyebrow="Business module" title="Vehicle Live Inspection" description="Record tyre readings and photographs for one vehicle per inspection session. Previous sessions remain available for review.">
        <div className="page-actions">
          <Button variant="secondary" onClick={() => { setNotice(''); setView('records'); }}>Manage clients, sites &amp; vehicles</Button>
          <Button onClick={() => { setNotice(''); setView('create'); }}>Start inspection</Button>
        </div>
      </PageContainer>
      {notice && <div className="success-message" role="status">{notice}</div>}
      {error && <ErrorMessage title="Inspection workspace unavailable">{error}</ErrorMessage>}
      {isLoading ? <LoadingState label="Loading inspection records" /> : view === 'records' ? (
        <InspectionRecords records={records} onRefresh={refresh} onBack={() => setView('history')} />
      ) : view === 'create' ? (
        records.clients.length && records.vehicles.length ? <InspectionForm records={records} onCancel={() => setView('history')} onSaved={handleSaved} /> : (
          <div><EmptyState title="Set up a vehicle first" description="Add a client, site and vehicle before starting an inspection." /><Button variant="secondary" onClick={() => setView('records')}>Manage clients, sites and vehicles</Button></div>
        )
      ) : (
        <InspectionHistory sessions={sessions} vehicles={records.vehicles} selectedVehicleId={selectedVehicleId} onFilter={setSelectedVehicleId} onOpen={(id) => { setSelectedSessionId(id); setView('details'); }} />
      )}
    </>
  );
}
