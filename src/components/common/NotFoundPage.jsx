import { Link } from 'react-router-dom';
import { routePaths } from '../../app/routePaths.js';

export function NotFoundPage() {
  return (
    <main className="system-message">
      <p className="eyebrow">Page not found</p>
      <h1>We can’t find that page.</h1>
      <p>Choose a section from the navigation to continue.</p>
      <Link className="text-link" to={routePaths.dashboard}>Go to dashboard</Link>
    </main>
  );
}
