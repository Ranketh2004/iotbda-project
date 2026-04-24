import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone,
  BellOff,
  CheckCircle2,
  UtensilsCrossed,
  Clock,
  CheckCircle,
  Hourglass,
  MessageSquare,
  PhoneMissed,
  ArrowRightCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { acknowledgeCryAlert, fetchEscalationStatus, fetchStatus } from '../services/api';

function formatEscTimer(totalSecs) {
  const t = Math.max(0, Math.floor(totalSecs || 0));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(ts) {
  if (ts == null) return '-';
  try {
    return new Date(ts * 1000).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

function badgeClass(badge) {
  if (badge === 'notified') return 'ok';
  if (badge === 'scheduled') return 'queued';
  if (badge === 'failed') return 'fail';
  if (badge === 'no_phone' || badge === 'idle') return 'idle';
  return 'pending';
}

function badgeLabel(badge) {
  const m = {
    notified: 'Notified',
    failed: 'Failed',
    scheduled: 'Queued',
    manual: 'Manual SMS',
    pending: 'Pending',
    no_phone: 'No number',
    idle: 'Standby',
  };
  return m[badge] || 'Pending';
}

function FlowIcon({ kind }) {
  if (kind === 'check') {
    return (
      <span className="esc-flow-ico esc-flow-ico--ok">
        <CheckCircle size={20} strokeWidth={2} />
      </span>
    );
  }
  if (kind === 'hourglass') {
    return (
      <span className="esc-flow-ico esc-flow-ico--wait">
        <Hourglass size={18} strokeWidth={2} />
      </span>
    );
  }
  if (kind === 'none') {
    return (
      <span className="esc-flow-ico esc-flow-ico--idle">
        <AlertCircle size={18} strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className="esc-flow-ico esc-flow-ico--pending">
      <Phone size={18} strokeWidth={2} />
    </span>
  );
}

function LogIcon({ kind }) {
  const wrap = 'esc-log-ico';
  if (kind === 'sms') {
    return (
      <span className={`${wrap} ${wrap}--sms`}>
        <MessageSquare size={18} strokeWidth={2} />
      </span>
    );
  }
  if (kind === 'missed') {
    return (
      <span className={`${wrap} ${wrap}--missed`}>
        <PhoneMissed size={18} strokeWidth={2} />
      </span>
    );
  }
  if (kind === 'escalate') {
    return (
      <span className={`${wrap} ${wrap}--escalate`}>
        <ArrowRightCircle size={18} strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className={`${wrap} ${wrap}--answered`}>
      <Phone size={18} strokeWidth={2} />
    </span>
  );
}

function buildLogRows(wave) {
  const evs = (wave?.events || []).slice();
  evs.sort((a, b) => (b.at || 0) - (a.at || 0));
  return evs.map((ev, i) => {
    const err = ev.status === 'error';
    const slot = ev.target || 'contact';
    return {
      id: `${ev.at}-${slot}-${i}`,
      time: formatTime(ev.at),
      icon: err ? 'missed' : 'sms',
      title: err
        ? `SMS failed, ${slot.replace('guardian', 'Guardian ').replace('parent', 'Parent ')}`
        : `SMS queued, ${slot.replace('guardian', 'Guardian ').replace('parent', 'Parent ')} (${ev.label || 'contact'})`,
      sub: err
        ? ev.detail || 'Gateway error'
        : ev.group_id
          ? `Gateway group ${ev.group_id} · ${ev.status || 'ok'}`
          : ev.detail || ev.status || 'Submitted to SMS API',
    };
  });
}

function nextCountdownSec(nextAuto) {
  const g1 = nextAuto?.guardian1;
  const g2 = nextAuto?.guardian2;
  const cands = [g1, g2].filter((n) => typeof n === 'number' && n > 0);
  if (cands.length === 0) return null;
  return Math.min(...cands);
}

export default function AlertEscalationPage() {
  const navigate = useNavigate();
  const [esc, setEsc] = useState(null);
  const [cryStatus, setCryStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ackBusy, setAckBusy] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem('cryguard_token');
    if (!token) {
      setLoading(false);
      setError('Sign in to view SMS escalation status.');
      return;
    }
    try {
      const [st, es] = await Promise.all([fetchStatus().catch(() => null), fetchEscalationStatus()]);
      if (st?.cry_status) setCryStatus(st.cry_status);
      setEsc(es);
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load escalation status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, [load]);

  const wave = esc?.wave;
  const contacts = esc?.contacts || [];
  const delays = esc?.delays_sec || { guardian1: 30, guardian2: 120 };
  const smsOk = esc?.sms_configured !== false;

  const logRows = useMemo(() => buildLogRows(wave), [wave]);

  const telHref = useMemo(() => {
    const c = contacts.find((x) => x.has_phone && x.phone_digits);
    if (!c?.phone_digits) return undefined;
    return `tel:+${String(c.phone_digits).replace(/^\+/, '')}`;
  }, [contacts]);

  const reasonText =
    (wave?.cry_label && String(wave.cry_label).trim()) ||
    (cryStatus?.cry_label && String(cryStatus.cry_label).trim()) ||
    '-';

  const startedLabel = wave?.started_at ? formatTime(wave.started_at) : '-';

  const nextSec = nextCountdownSec(esc?.next_auto_sec);
  const timerSecs = nextSec != null ? nextSec : 0;

  const handleAckStop = async (goDashboard) => {
    setAckBusy(true);
    try {
      await acknowledgeCryAlert();
    } catch {
      /* ignore */
    } finally {
      setAckBusy(false);
      if (goDashboard) navigate('/dashboard');
      else load();
    }
  };

  return (
    <div className="settings-page esc-page">
      <div className="analytics-shell esc-shell">
        <nav className="esc-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard">Dashboard</Link>
          <span className="esc-breadcrumb-sep" aria-hidden>
            {' '}
            &gt;{' '}
          </span>
          <span className="esc-breadcrumb-current">Alert Escalation</span>
        </nav>

        <header className="esc-page-head">
          <h1 className="analytics-title">Emergency Alert Escalation</h1>
          <p className="analytics-subtitle">
            SMS hierarchy: Parent 1 first (automatic), then Guardian 1 after {delays.guardian1}s and Guardian 2
            after {delays.guardian2}s unless you acknowledge. Parent 2 is manual from the cry alert screen.
          </p>
        </header>

        {!smsOk && (
          <p className="esc-banner-warn" role="status">
            SMS gateway is not configured on the server (set KEEN_SMS_* env vars). Contact rows show your numbers,
            but texts will not send.
          </p>
        )}
        {error && (
          <p className="esc-banner-warn" role="alert">
            {error}
          </p>
        )}

        <section className="settings-card esc-main-card" aria-labelledby="esc-alert-heading">
          <div className="esc-main-grid">
            <div className="esc-live-col">
              <span className="esc-live-tag">
                <span className="esc-live-dot" aria-hidden />
                LIVE FEED
              </span>
              <div className="esc-live-frame">
                <img
                  src="/images/login-nursery.webp"
                  alt="Nursery camera feed"
                  className="esc-live-img"
                />
              </div>
            </div>
            <div className="esc-alert-col">
              <div className="esc-alert-top">
                <div>
                  <p className="esc-alert-critical">
                    {wave?.active ? 'ACTIVE ALERT · CRITICAL' : 'No active SMS wave'}
                  </p>
                  <h2 id="esc-alert-heading" className="esc-alert-title">
                    {wave?.active ? 'Baby Crying Detected' : 'Monitoring'}
                  </h2>
                  <div className="esc-meta-row">
                    <div className="esc-meta-pill">
                      <UtensilsCrossed size={16} aria-hidden />
                      <span>
                        Likely reason: <strong>{reasonText}</strong>
                      </span>
                    </div>
                    <div className="esc-meta-pill">
                      <Clock size={16} aria-hidden />
                      <span>
                        Wave started: <strong>{startedLabel}</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="esc-escalation-timer-box">
                  <span className="esc-escalation-timer-label">Next auto SMS in</span>
                  <span className="esc-escalation-timer-val" aria-live="polite">
                    {loading ? '-' : wave?.active && !wave?.acknowledged ? formatEscTimer(timerSecs) : '-'}
                  </span>
                </div>
              </div>
              <div className="esc-action-row">
                {telHref ? (
                  <a className="esc-action-btn esc-action-btn--call" href={telHref}>
                    <Phone size={20} strokeWidth={2} />
                    Call now
                  </a>
                ) : (
                  <button type="button" className="esc-action-btn esc-action-btn--call" disabled>
                    <Phone size={20} strokeWidth={2} />
                    Call now
                  </button>
                )}
                <button
                  type="button"
                  className="esc-action-btn esc-action-btn--stop"
                  disabled={ackBusy}
                  onClick={() => handleAckStop(false)}
                >
                  {ackBusy ? <Loader2 size={20} className="esc-btn-spin" /> : <BellOff size={20} strokeWidth={2} />}
                  Stop alert
                </button>
                <button
                  type="button"
                  className="esc-action-btn esc-action-btn--resolve"
                  disabled={ackBusy}
                  onClick={() => handleAckStop(true)}
                >
                  <CheckCircle2 size={20} strokeWidth={2} />
                  Mark resolved
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card esc-flow-card" aria-labelledby="esc-flow-heading">
          <h2 id="esc-flow-heading" className="esc-section-title">
            Notification status (SMS)
          </h2>
          <div className="esc-flow-track">
            {contacts.length === 0 && <p className="esc-flow-empty">No contacts loaded.</p>}
            {contacts.map((c, i) => (
              <React.Fragment key={c.slot}>
                <div className="esc-flow-node">
                  <FlowIcon kind={c.icon} />
                  <p className="esc-flow-role">
                    {c.label ? `${c.role}, ${c.label}` : c.role}
                  </p>
                  <span className={`esc-flow-badge esc-flow-badge--${badgeClass(c.badge)}`}>
                    {badgeLabel(c.badge)}
                  </span>
                  <p className="esc-flow-phone">{c.phone_display || '-'}</p>
                </div>
                {i < contacts.length - 1 && <span className="esc-flow-connector" aria-hidden />}
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="settings-card esc-logs-card">
          <div className="esc-logs-head">
            <h2 className="esc-section-title">Contact log (SMS API)</h2>
            <button
              type="button"
              className="esc-download-link"
              disabled={!logRows.length}
              onClick={() => {
                const blob = new Blob([JSON.stringify(wave?.events || [], null, 2)], {
                  type: 'application/json',
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `cry-sms-log-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Download log
            </button>
          </div>
          {logRows.length === 0 ? (
            <p className="esc-logs-empty">
              No SMS events in the last 15 minutes. When a cry alert fires, Parent 1 receives the first text;
              Guardian 1 and Guardian 2 follow on the timer unless you acknowledge from the dashboard modal.
            </p>
          ) : (
            <ul className="esc-logs-list">
              {logRows.map((log) => (
                <li key={log.id} className="esc-log-row">
                  <LogIcon kind={log.icon} />
                  <div className="esc-log-body">
                    <span className="esc-log-time">{log.time}</span>
                    <p className="esc-log-title">{log.title}</p>
                    <p className="esc-log-sub">{log.sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="esc-page-footnote">
          © {new Date().getFullYear()} Infant Cry Guard. SMS delivery uses your Keen Systems route; status here reflects
          API submissions, not carrier delivery receipts.
        </p>
      </div>
    </div>
  );
}
