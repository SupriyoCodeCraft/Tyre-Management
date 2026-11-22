import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { NotFoundPage } from '../components/common/NotFoundPage.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { InspectionPage } from '../features/inspection/InspectionPage.jsx';
import { PurchasePage } from '../features/purchases/PurchasePage.jsx';
import { TyreHistoryPage } from '../features/tyre-history/TyreHistoryPage.jsx';
import { ScrapAnalysisPage } from '../features/scrap-analysis/ScrapAnalysisPage.jsx';
import { routePaths } from './routePaths.js';
import { AuthenticatedRedirect, ProtectedRoute } from './ProtectedRoute.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path={routePaths.login}
        element={
          <AuthenticatedRedirect>
            <LoginPage />
          </AuthenticatedRedirect>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={routePaths.dashboard} replace />} />
        <Route path={routePaths.dashboard} element={<DashboardPage />} />
        <Route path={routePaths.inspection} element={<InspectionPage />} />
        <Route path={routePaths.purchases} element={<PurchasePage />} />
        <Route path={routePaths.tyreHistory} element={<TyreHistoryPage />} />
        <Route path={routePaths.scrapAnalysis} element={<ScrapAnalysisPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
