import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import DashboardFooter from '../components/DashboardFooter';

const CONTACTS = [
  {
    id: 'p1',
    role: 'Parent 1',
    name: 'Sarah',
    phone: '+94 77 XXX 1234',
    status: 'notified',
    icon: 'check',
  },
  {
    id: 'p2',
    role: 'Parent 2',
    name: 'David',
    phone: '+94 77 XXX 5678',
    status: 'pending',
    icon: 'phone',
  },
  {
    id: 'g1',
    role: 'Guardian 1',
    name: 'Elena',
    phone: '+94 77 XXX 9012',
    status: 'pending',
    icon: 'phone',
  },
  {
    id: 'g2',
    role: 'Guardian 2',
    name: 'James',
    phone: '+94 77 XXX 3456',
    status: 'queued',
    icon: 'hourglass',
  },
];

const LOGS = [
  {
    id: '1',
    time: '10:45:05 PM',
    icon: 'sms',
    title: 'SMS Sent to Parent 1 (Sarah)',
    sub: 'Delivered successfully',
  },
  {
    id: '2',
    time: '10:46:12 PM',
    icon: 'missed',
    title: 'Call to Parent 1 (Sarah)',
    sub: 'No response after 45s',
  },
  {
    id: '3',
    time: '10:47:00 PM',
    icon: 'escalate',
    title: 'Escalated to Parent 2 (David)',
    sub: 'Triggered automatically',
  },
  {
    id: '4',
    time: '10:48:45 PM',
    icon: 'answered',
    title: 'Call to Parent 2 (David)',
    sub: 'Status: Responded',
  },
];

function formatEscTimer(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

export default function AlertEscalationPage() {
  const navigate = useNavigate();
  const [timerSecs, setTimerSecs] = useState(105);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTimerSecs((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="dash-page settings-page esc-page">
      <DashboardHeader />

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
            Real-time monitoring and automated contact sequence
          </p>
        </header>

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
                  <p className="esc-alert-critical">Active alert · Critical</p>
                  <h2 id="esc-alert-heading" className="esc-alert-title">
                    Baby Crying Detected
                  </h2>
                  <div className="esc-meta-row">
                    <div className="esc-meta-pill">
                      <UtensilsCrossed size={16} aria-hidden />
                      <span>
                        Likely reason: <strong>Hungry</strong>
                      </span>
                    </div>
                    <div className="esc-meta-pill">
                      <Clock size={16} aria-hidden />
                      <span>
                        Time started: <strong>10:45 PM</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="esc-escalation-timer-box">
                  <span className="esc-escalation-timer-label">Escalation timer</span>
                  <span className="esc-escalation-timer-val" aria-live="polite">
                    {formatEscTimer(timerSecs)}
                  </span>
                </div>
              </div>
              <div className="esc-action-row">
                <a className="esc-action-btn esc-action-btn--call" href="tel:">
                  <Phone size={20} strokeWidth={2} />
                  Call Now
                </a>
                <button
                  type="button"
                  className="esc-action-btn esc-action-btn--stop"
                  onClick={() => navigate('/dashboard')}
                >
                  <BellOff size={20} strokeWidth={2} />
                  Stop Alert
                </button>
                <button
                  type="button"
                  className="esc-action-btn esc-action-btn--resolve"
                  onClick={() => navigate('/dashboard')}
                >
                  <CheckCircle2 size={20} strokeWidth={2} />
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card esc-flow-card" aria-labelledby="esc-flow-heading">
          <h2 id="esc-flow-heading" className="esc-section-title">
            Notification status
          </h2>
          <div className="esc-flow-track">
            {CONTACTS.map((c, i) => (
              <React.Fragment key={c.id}>
                <div className="esc-flow-node">
                  <FlowIcon kind={c.icon} />
                  <p className="esc-flow-role">
                    {c.role} ({c.name})
                  </p>
                  <span
                    className={`esc-flow-badge esc-flow-badge--${c.status === 'notified' ? 'ok' : c.status === 'queued' ? 'queued' : 'pending'}`}
                  >
                    {c.status === 'notified' ? 'Notified' : 'Pending'}
                  </span>
                  <p className="esc-flow-phone">{c.phone}</p>
                </div>
                {i < CONTACTS.length - 1 && <span className="esc-flow-connector" aria-hidden />}
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="settings-card esc-logs-card">
          <div className="esc-logs-head">
            <h2 className="esc-section-title">Contact Logs</h2>
            <button type="button" className="esc-download-link">
              Download Report
            </button>
          </div>
          <ul className="esc-logs-list">
            {LOGS.map((log) => (
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
        </section>

        <p className="esc-page-footnote">
          © {new Date().getFullYear()} Infant Cry Guard. Professional IoT Health Monitoring.
        </p>
      </div>

      <DashboardFooter />
    </div>
  );
}
