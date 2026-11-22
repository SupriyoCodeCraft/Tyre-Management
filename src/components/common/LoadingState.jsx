export function LoadingState({ label = 'Loading' }) {
  return <div className="status-panel" role="status"><span className="spinner" aria-hidden="true" />{label}…</div>;
}
