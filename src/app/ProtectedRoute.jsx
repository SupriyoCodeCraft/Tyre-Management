import { Navigate, useLocation } from 'react-router-dom';
import { routePaths } from './routePaths.js';
import { useAuth } from '../features/auth/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={routePaths.login} state={{ from: location }} replace />;
  }

  return children;
}

export function AuthenticatedRedirect({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const destination = location.state?.from;
  const destinationPath = destination
    ? `${destination.pathname}${destination.search ?? ''}${destination.hash ?? ''}`
    : routePaths.dashboard;

  return isAuthenticated ? <Navigate to={destinationPath} replace /> : children;
}
