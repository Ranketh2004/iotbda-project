import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Thermometer,
  UserCheck,
  Router,
  Trash2,
  Settings,
} from 'lucide-react';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'activity', label: 'Activity' },
  { id: 'system', label: 'System' },
];

const INITIAL_ITEMS = [
  {
    id: '1',
    tab: 'alerts',
    title: 'Baby Crying Detected',
    badge: 'Alert',
    body: 'Likely reason: Hungry. Audio intensity at 85dB.',
    time: 'Just now',
    unread: true,
    icon: 'bell',
    actions: [
      { id: 'stream', label: 'Open Live Stream', variant: 'primary' },
      { id: 'dismiss', label: 'Dismiss', variant: 'muted' },
    ],
  },
  {
    id: '2',
    tab: 'alerts',
    title: 'Temperature Threshold Exceeded',
    badge: 'Alert',
    body: 'Current room temperature: 28°C. Recommended range: 18°C - 22°C.',
    time: '10 mins ago',
    unread: true,
    icon: 'thermo',
    actions: [],
  },
  {
    id: '3',
    tab: 'activity',
    title: 'Guardian Notified',
    badge: 'Activity',
    body: 'Guardian 1 (Dad) acknowledged the 2:10 PM cry alert.',
    time: 'Today, 2:15 PM',
    unread: false,
    icon: 'guardian',
    actions: [],
  },
  {
    id: '4',
    tab: 'system',
    title: 'Device Online',
    badge: 'System',
    body: 'Camera unit connected successfully. Firmware v2.4.1 is up to date.',
    time: 'Today, 8:00 AM',
    unread: false,
    icon: 'device',
    actions: [],
  },
];

function NotifIcon({ kind }) {
  const wrap = 'notif-card-icon';
  if (kind === 'bell') {
    return (
      <span className={`${wrap} ${wrap}--alert`} aria-hidden>
        <Bell size={22} strokeWidth={2} />
      </span>
    );
  }
  if (kind === 'thermo') {
    return (
      <span className={`${wrap} ${wrap}--warn`} aria-hidden>
        <Thermometer size={22} strokeWidth={2} />
      </span>
    );
  }
  if (kind === 'guardian') {
    return (
      <span className={`${wrap} ${wrap}--ok`} aria-hidden>
        <UserCheck size={22} strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className={`${wrap} ${wrap}--info`} aria-hidden>
      <Router size={22} strokeWidth={2} />
    </span>
  );
}

export default function NotificationHistoryPage() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState(INITIAL_ITEMS);

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((n) => n.tab === tab);
  }, [items, tab]);

  const clearAll = () => setItems([]);

  return (
    <div className="settings-page">
      <div className="analytics-shell notif-shell">
        <div className="notif-page-head">
          <div className="notif-page-head-text">
            <h1 className="analytics-title">Notification History</h1>
            <p className="analytics-subtitle">
              Stay updated on your baby&apos;s activities and system health.
            </p>
          </div>
          <div className="notif-page-actions">
            <button type="button" className="notif-link-btn" onClick={clearAll} disabled={items.length === 0}>
              <Trash2 size={18} strokeWidth={2} aria-hidden />
              Clear All
            </button>
            <Link to="/dashboard/notifications/settings" className="notif-gear-btn notif-gear-btn--link">
              <Settings size={18} strokeWidth={2} aria-hidden />
              Notification Settings
            </Link>
          </div>
        </div>

        <div className="notif-tabs" role="tablist" aria-label="Notification categories">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`notif-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ul className="notif-list">
          {filtered.length === 0 ? (
            <li className="notif-empty">No notifications to show.</li>
          ) : (
            filtered.map((n) => (
              <li key={n.id} className="notif-card">
                <div className="notif-card-main">
                  <NotifIcon kind={n.icon} />
                  <div className="notif-card-body">
                    <div className="notif-card-title-row">
                      <h2 className="notif-card-title">{n.title}</h2>
                      <span className="notif-card-badge">{n.badge}</span>
                    </div>
                    <p className="notif-card-desc">{n.body}</p>
                    {n.actions.length > 0 && (
                      <div className="notif-card-actions">
                        {n.actions.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={
                              a.variant === 'primary' ? 'notif-action-primary' : 'notif-action-muted'
                            }
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="notif-card-meta">
                  <span className="notif-card-time">{n.time}</span>
                  {n.unread && <span className="notif-unread-dot" aria-label="Unread" />}
                </div>
              </li>
            ))
          )}
        </ul>

        {filtered.length > 0 && (
          <div className="notif-footer-link-wrap">
            <button type="button" className="notif-older-link">
              View Older Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
