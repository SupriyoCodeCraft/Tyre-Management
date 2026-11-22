import { EmptyState } from '../../components/common/EmptyState.jsx';
export function InspectionHistory({ sessions, vehicles, selectedVehicleId, onFilter, onOpen }) {
  if (!sessions.length && !selectedVehicleId) {
    return <EmptyState title="No inspections recorded yet" description="Start a vehicle inspection to create the first historical session." />;
  }
  const visible = selectedVehicleId ? sessions.filter((session) => session.vehicleId === selectedVehicleId) : sessions;
  return (
    <section className="inspection-history" aria-labelledby="inspection-history-title">
      <div className="section-heading"><div><h2 id="inspection-history-title">Previous inspections</h2><p>Each session remains available as a separate historical record.</p></div></div>
      <div className="register-toolbar">
        <div className="field"><label className="field-label" htmlFor="inspection-history-vehicle">Filter by vehicle</label><select className="input select" id="inspection-history-vehicle" value={selectedVehicleId} onChange={(event) => onFilter(event.target.value)}><option value="">All vehicles</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}</select></div>
        <span className="result-count">{visible.length} {visible.length === 1 ? 'inspection' : 'inspections'}</span>
      </div>
      {!visible.length ? <EmptyState title="No inspections for this vehicle" description="Choose another vehicle or start a new inspection." /> : (
        <div className="table-wrap responsive-table-wrap"><table className="data-table responsive-table"><thead><tr><th>Date</th><th>Vehicle</th><th>Tyres inspected</th><th>Details</th></tr></thead><tbody>
          {visible.map((session) => <tr key={session.id}><td data-label="Date">{session.inspectionDate}</td><td data-label="Vehicle">{session.vehicle?.registrationNumber ?? 'Vehicle unavailable'}{session.vehicle?.description ? ` · ${session.vehicle.description}` : ''}</td><td data-label="Tyres inspected">{session.tyreCount}</td><td data-label="Details"><button type="button" className="table-link" onClick={() => onOpen(session.id)}>Open inspection</button></td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
