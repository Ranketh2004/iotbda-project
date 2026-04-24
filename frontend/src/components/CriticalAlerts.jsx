import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'cryguard_critical_alerts_dismissed';

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

const DESCRIPTION = {
  lead:
    'High-priority environment and device notices appear here alongside your nursery overview. They are separate from the activity timeline (cry + motion history).',
  detail:
    'Urgent cry SMS still follows your escalation order (Parent 1 → timed guardians, Parent 2 manual). Clearing an alert below only hides it on this browser — it does not change SMS settings or MongoDB data.',
};

function loadDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    if (!set || set.size === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-80)));
    }
  } catch {
    /* ignore */
  }
}

export default function CriticalAlerts() {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [selected, setSelected] = useState(() => new Set());
  const panelId = useId();
  const listId = `${panelId}-alerts`;

  const alerts = useMemo(
    () => DEFAULT_ALERTS.filter((a) => !dismissed.has(a.id)),
    [dismissed],
  );

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      for (const id of prev) {
        if (alerts.some((a) => a.id === id)) next.add(id);
      }
      return next;
    });
  }, [alerts]);

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(alerts.map((a) => a.id)));
  }, [alerts]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const addDismissed = useCallback((ids) => {
    if (!ids.length) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveDismissed(next);
      return next;
    });
    setSelected(new Set());
  }, []);

  const dismissSelected = useCallback(() => {
    addDismissed([...selected]);
  }, [addDismissed, selected]);

  const dismissAll = useCallback(() => {
    addDismissed(alerts.map((a) => a.id));
  }, [addDismissed, alerts]);

  const restoreDefaults = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
    setSelected(new Set());
  }, []);

  return (
    <section className="dash-alerts-card" aria-labelledby="alerts-heading">
      <div className="dash-alerts-head">
        <div className="dash-alerts-head-text">
          <h3 id="alerts-heading" className="dash-alerts-title">
            Critical Alerts
          </h3>
        </div>
        <button
          type="button"
          className="dash-alerts-collapse"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={listId}
          title={expanded ? 'Collapse alerts' : 'Expand alerts'}
        >
          {expanded ? <ChevronUp size={22} strokeWidth={2.2} /> : <ChevronDown size={22} strokeWidth={2.2} />}
        </button>
      </div>

      {expanded && (
        <>
          <div className="dash-alerts-desc">
            <p className="dash-alerts-desc-lead">{DESCRIPTION.lead}</p>
            <p className="dash-alerts-desc-detail">{DESCRIPTION.detail}</p>
          </div>

          {alerts.length > 0 && (
            <div className="dash-alerts-toolbar" role="toolbar" aria-label="Alert selection">
              <button type="button" className="dash-alerts-tool-btn" onClick={selectAll}>
                Select all
              </button>
              <button
                type="button"
                className="dash-alerts-tool-btn"
                onClick={clearSelection}
                disabled={selected.size === 0}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="dash-alerts-tool-btn dash-alerts-tool-btn--primary"
                onClick={dismissSelected}
                disabled={selected.size === 0}
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden />
                Dismiss selected
              </button>
            </div>
          )}

          {alerts.length === 0 ? (
            <p className="dash-alerts-empty">
              No active alerts.
              {dismissed.size > 0 && (
                <>
                  {' '}
                  <button type="button" className="dash-alerts-restore-link" onClick={restoreDefaults}>
                    Restore defaults
                  </button>
                </>
              )}
            </p>
          ) : (
            <ul id={listId} className="dash-alerts-list">
              {alerts.map((a) => {
                const checked = selected.has(a.id);
                return (
                  <li key={a.id} className={`dash-alert-row dash-alert-row--${a.variant}`}>
                    <label className="dash-alert-check">
                      <input
                        type="checkbox"
                        className="dash-alert-check-input"
                        checked={checked}
                        onChange={() => toggleSelect(a.id)}
                        aria-label={`Select alert: ${a.title}`}
                      />
                    </label>
                    <span className={`dash-alert-icon-wrap dash-alert-icon-wrap--${a.variant}`}>
                      {a.variant === 'danger' ? (
                        <AlertTriangle size={18} className="dash-alert-icon" aria-hidden />
                      ) : (
                        <Info size={18} className="dash-alert-icon" aria-hidden />
                      )}
                    </span>
                    <div className="dash-alert-copy">
                      <p className="dash-alert-title">{a.title}</p>
                      <p className="dash-alert-body">{a.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {alerts.length > 0 && (
            <button type="button" className="dash-alerts-dismiss" onClick={dismissAll}>
              Dismiss All
            </button>
          )}
        </>
      )}
    </section>
  );
}
