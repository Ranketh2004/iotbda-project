import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User } from 'lucide-react';
import BrandLogoMark from './BrandLogoMark';
import { useDashboardSession } from '../context/DashboardSessionContext';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('cryguard_user') || 'null');
  } catch {
    return null;
  }
}

const BRAND = 'Infant Cry Guard';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/analytics', label: 'Insights' },
  { to: '/dashboard/daily-care', label: 'Daily care' },
  { to: '/dashboard/settings', label: 'Settings' },
];

function linkActive(path, to) {
  if (to === '/dashboard') {
    return path === '/dashboard' || path === '/dashboard/';
  }
  return path === to || path.startsWith(`${to}/`);
}

export default function DashboardHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { sessionNonce } = useDashboardSession();

  const handleLogout = () => {
    localStorage.removeItem('cryguard_token');
    localStorage.removeItem('cryguard_user');
    navigate('/login', { replace: true });
  };

  const storedUser = useMemo(() => readStoredUser(), [sessionNonce]);

  const displayName = useMemo(() => {
    if (!storedUser) return '';
    if (storedUser.fullName) return storedUser.fullName;
    const email = storedUser.email || '';
    return email.includes('@') ? email.split('@')[0] : email;
  }, [storedUser]);

  return (
    <header className="dash-header">
      <div className="dash-header-inner">
        <div className="dash-header-left">
          <Link to="/" className="dash-brand">
            <span className="dash-brand-icon" aria-hidden>
              <BrandLogoMark compact />
            </span>
            <span className="dash-brand-name">{BRAND}</span>
          </Link>
        </div>
        <nav className="dash-nav" aria-label="Dashboard">
          {links.map(({ to, label }) => (
            <Link key={to} to={to} className={`dash-nav-link ${linkActive(path, to) ? 'active' : ''}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="dash-header-tools">
          {displayName && (
            <span className="dash-user-name">{displayName}</span>
          )}
          <Link
            to="/dashboard/notifications"
            className={`dash-icon-btn ${path.startsWith('/dashboard/notifications') ? 'dash-icon-btn--active' : ''}`}
            aria-label="Notification history"
            aria-current={path.startsWith('/dashboard/notifications') ? 'page' : undefined}
          >
            <Bell size={20} />
          </Link>
          <Link
            to="/dashboard/profile"
            className={`dash-icon-btn dash-icon-btn--profile ${path.startsWith('/dashboard/profile') ? 'dash-icon-btn--active' : ''}`}
            aria-label="Profile"
            aria-current={path.startsWith('/dashboard/profile') ? 'page' : undefined}
          >
            <User size={20} strokeWidth={2.1} />
          </Link>
          <button
            type="button"
            className="dash-icon-btn"
            aria-label="Logout"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
