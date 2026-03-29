import React, { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

const DEFAULT_ALERTS = [
  {
    id: 'hum',
    variant: 'danger',
    title: 'High Humidity Alert',
    body: 'Humidity exceeded 60% for 10 mins.',
  },
  {
    id: 'fw',
    variant: 'info',
    title: 'Firmware Update',
    body: 'Version 2.4.1 ready for installation.',
  },
];

export default function CriticalAlerts() {
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS);

  const dismissAll = () => setAlerts([]);

  return (
    <section className="dash-alerts-card" aria-labelledby="alerts-heading">
      <h3 id="alerts-heading" className="dash-alerts-title">
        Critical Alerts
      </h3>
      {alerts.length === 0 ? (
        <p className="dash-alerts-empty">No active alerts.</p>
      ) : (
        <ul className="dash-alerts-list">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`dash-alert-box dash-alert-box--${a.variant}`}
            >
              {a.variant === 'danger' ? (
                <AlertTriangle size={18} className="dash-alert-icon" />
              ) : (
                <Info size={18} className="dash-alert-icon" />
              )}
              <div>
                <p className="dash-alert-title">{a.title}</p>
                <p className="dash-alert-body">{a.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > 0 && (
        <button type="button" className="dash-alerts-dismiss" onClick={dismissAll}>
          Dismiss All
        </button>
      )}
    </section>
  );
}
