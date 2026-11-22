import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { routePaths } from '../../app/routePaths.js';
import { useAuth } from '../../features/auth/AuthContext.jsx';

const navigationItems = [
  { to: routePaths.dashboard, label: 'Dashboard' },
  { to: routePaths.inspection, label: 'Vehicle Live Inspection' },
  { to: routePaths.purchases, label: 'Purchase Register' },
  { to: routePaths.tyreHistory, label: 'Tyre History' },
  { to: routePaths.scrapAnalysis, label: 'Scrap Analysis' },
];

export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate(routePaths.login, { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" to={routePaths.dashboard} aria-label="Tyre Management dashboard" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Tyre Management</span>
        </Link>
        <div className="header-actions">
          <span className="header-context">Operator workspace</span>
          <button className="mobile-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
            <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span><span className="sr-only">{menuOpen ? 'Close navigation' : 'Open navigation'}</span>
          </button>
          <button className="logout-button" type="button" onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <div className="app-body">
        <nav id="primary-navigation" className={`side-navigation${menuOpen ? ' side-navigation-open' : ''}`} aria-label="Main navigation">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              end={item.to === routePaths.dashboard}
              className={({ isActive }) =>
                isActive ? 'navigation-link navigation-link-active' : 'navigation-link'
              }
              to={item.to}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="main-content" key={location.pathname}><Outlet /></main>
      </div>
    </div>
  );
}
