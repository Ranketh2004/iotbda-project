import React from 'react';
import { Bell, Radio, Wifi } from 'lucide-react';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationsPanel({ notifications }) {
  // Show newest first
  const sorted = [...notifications].reverse();

  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h2>
          <Bell size={18} /> Notifications
        </h2>
        {notifications.length > 0 && (
          <span className="notification-count">{notifications.length}</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">No cry alerts yet. Monitoring...</div>
      ) : (
        <ul className="notification-list">
          {sorted.map((n, i) => (
            <li key={`${n.timestamp}-${i}`} className="notification-item">
              <div className="notification-dot" />
              <div className="notification-content">
                <p>{n.message}</p>
                <div className="notification-meta">
                  <span className="notification-time">{formatDate(n.timestamp)} {formatTime(n.timestamp)}</span>
                  {n.source === 'realtime_stream' && (
                    <span className="notification-source">
                      <Radio size={10} /> Live Stream
                    </span>
                  )}
                  {n.source !== 'realtime_stream' && n.source && (
                    <span className="notification-source">
                      <Wifi size={10} /> HTTP
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
