import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import DashboardHome from './pages/DashboardHome';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import NotificationHistoryPage from './pages/NotificationHistoryPage';
import AlertSettingsPage from './pages/AlertSettingsPage';
import ProfilePage from './pages/ProfilePage';
import AlertEscalationPage from './pages/AlertEscalationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />}>
        <Route index element={<DashboardHome />} />
        <Route path="alert-escalation" element={<AlertEscalationPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications/settings" element={<AlertSettingsPage />} />
        <Route path="notifications" element={<NotificationHistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}
