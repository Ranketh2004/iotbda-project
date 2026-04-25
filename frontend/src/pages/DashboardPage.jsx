import React, { useCallback, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import DashboardFooter from '../components/DashboardFooter';
import { DashboardSessionContext } from '../context/DashboardSessionContext';

export default function DashboardPage() {
  const [sessionNonce, setSessionNonce] = useState(0);
  const bumpSession = useCallback(() => setSessionNonce((n) => n + 1), []);
  const ctxValue = useMemo(() => ({ bumpSession, sessionNonce }), [bumpSession, sessionNonce]);

  return (
    <DashboardSessionContext.Provider value={ctxValue}>
      <div className="dash-page">
        <a href="#dashboard-main" className="skip-link">
          Skip to main content
        </a>
        <DashboardHeader />
        <main id="dashboard-main" className="dash-page-body" tabIndex={-1}>
          <Outlet />
        </main>
        <DashboardFooter />
      </div>
    </DashboardSessionContext.Provider>
  );
}
