import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
