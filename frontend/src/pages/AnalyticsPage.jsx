import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  AlertOctagon,
  Timer,
  TrendingDown,
  TrendingUp,
  Thermometer,
  Droplets,
  Moon,
  Sun,
  Frown,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import DashboardFooter from '../components/DashboardFooter';
import CryAlertDetailModal from '../components/CryAlertDetailModal';

const FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'critical', label: 'CRITICAL' },
  { id: 'mild', label: 'MILD' },
];

const EVENTS = [
  {
    id: '1',
    reason: 'Hungry',
    severity: 'critical',
    confidence: 94,
    confidenceVariant: 'green',
    time: 'Today at 2:14 PM',
    icon: 'frown',
    iconTone: 'blue',
    temp: '26°C',
    humidity: '65%',
    light: 'Soft',
    lightIcon: 'sun',
    footerLeft: 'No significant motion',
    footerMid: 'Escalation not required',
    escalation: null,
    motion: 'None',
  },
  {
    id: '2',
    reason: 'Tired / Sleepy',
    severity: 'critical',
    confidence: 81,
    confidenceVariant: 'yellow',
    time: 'Today at 11:30 AM',
    icon: 'moon',
    iconTone: 'yellow',
    temp: '27°C',
    humidity: '68%',
    light: 'Dim',
    lightIcon: 'moon',
    footerLeft: 'Frequent movement detected',
    footerMid: null,
    escalation: 'triggered',
    motion: 'Detected',
  },
  {
    id: '3',
    reason: 'Discomfort',
    severity: 'mild',
    confidence: 72,
    confidenceVariant: 'grey',
    time: 'Today at 8:45 AM',
    icon: 'circle',
    iconTone: 'grey',
    temp: '25°C',
    humidity: '62%',
    light: null,
    lightIcon: null,
    footerLeft: 'Self-soothed after 45s',
    footerMid: null,
    escalation: null,
    motion: 'None',
  },
];

function EventIcon({ type, tone }) {
  const wrap = `analytics-ev-icon analytics-ev-icon--${tone}`;
  if (type === 'frown') {
    return (
      <span className={wrap}>
        <Frown size={22} strokeWidth={2} />
      </span>
    );
  }
  if (type === 'moon') {
    return (
      <span className={wrap}>
        <Moon size={22} strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className={wrap}>
      <CheckCircle2 size={22} strokeWidth={2} />
    </span>
  );
}

function LightIcon({ kind }) {
  if (kind === 'moon') return <Moon size={14} />;
  return <Sun size={14} />;
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [detailEvent, setDetailEvent] = useState(null);

  const visibleEvents = useMemo(() => {
    if (filter === 'all') return EVENTS;
    if (filter === 'critical') return EVENTS.filter((e) => e.severity === 'critical');
    return EVENTS.filter((e) => e.severity === 'mild');
  }, [filter]);

  return (
    <div className="dash-page analytics-page">
      <DashboardHeader />

      <div className="analytics-shell">
        <header className="analytics-page-head">
          <h1 className="analytics-title">Cry History</h1>
          <p className="analytics-subtitle">
            Analysis and patterns for baby&apos;s well-being in Colombo, Sri Lanka.
          </p>
        </header>

        <div className="analytics-stats">
          <article className="analytics-stat-card">
            <UtensilsCrossed size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Most Common Reason</p>
            <p className="analytics-stat-value">Hungry</p>
            <p className="analytics-stat-trend analytics-stat-trend--down">
              <TrendingDown size={14} /> 10% from last week
            </p>
          </article>
          <article className="analytics-stat-card">
            <AlertOctagon size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Cry Alerts Today</p>
            <p className="analytics-stat-value">4</p>
            <p className="analytics-stat-trend analytics-stat-trend--up">
              <TrendingUp size={14} /> 2% from average
            </p>
          </article>
          <article className="analytics-stat-card">
            <Timer size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Avg. Response Time</p>
            <p className="analytics-stat-value">1m 20s</p>
            <p className="analytics-stat-neutral">Consistent with yesterday</p>
          </article>
        </div>

        <section className="analytics-recent">
          <div className="analytics-recent-head">
            <h2 className="analytics-recent-title">Recent Events</h2>
            <div className="analytics-recent-tools">
              <button type="button" className="analytics-date-btn">
                Today, Oct 24
              </button>
              <div className="analytics-filter" role="group" aria-label="Filter events">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`analytics-filter-btn ${filter === f.id ? 'active' : ''}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ul className="analytics-event-list">
            {visibleEvents.map((ev) => (
              <li key={ev.id} className="analytics-event-card">
                <div className="analytics-event-top">
                  <EventIcon type={ev.icon} tone={ev.iconTone} />
                  <div className="analytics-event-main">
                    <div className="analytics-event-title-row">
                      <span className="analytics-event-reason">{ev.reason}</span>
                      <span
                        className={`analytics-badge analytics-badge--${ev.confidenceVariant}`}
                      >
                        {ev.confidence}% CONFIDENCE
                      </span>
                    </div>
                    <p className="analytics-event-time">{ev.time}</p>
                  </div>
                  <div className="analytics-event-metrics">
                    <div className="analytics-metric">
                      <Thermometer size={14} className="analytics-metric-ico" />
                      <span className="analytics-metric-label">TEMP</span>
                      <span className="analytics-metric-val">{ev.temp}</span>
                    </div>
                    <div className="analytics-metric">
                      <Droplets size={14} className="analytics-metric-ico" />
                      <span className="analytics-metric-label">HUMIDITY</span>
                      <span className="analytics-metric-val">{ev.humidity}</span>
                    </div>
                    {ev.light != null && (
                      <div className="analytics-metric">
                        <span className="analytics-metric-ico-wrap">
                          <LightIcon kind={ev.lightIcon} />
                        </span>
                        <span className="analytics-metric-label">LIGHT</span>
                        <span className="analytics-metric-val">{ev.light}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="analytics-event-foot">
                  <div className="analytics-event-foot-left">
                    {ev.footerLeft && (
                      <span className="analytics-foot-text">
                        {ev.escalation === 'triggered' && (
                          <AlertTriangle size={14} className="analytics-foot-warn" />
                        )}
                        {ev.footerLeft}
                      </span>
                    )}
                    {ev.footerMid && (
                      <span className="analytics-foot-mid">{ev.footerMid}</span>
                    )}
                    {ev.escalation === 'triggered' && (
                      <span className="analytics-esc-badge">Escalation Triggered</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="analytics-details-link"
                    onClick={() => setDetailEvent(ev)}
                  >
                    Details &gt;
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="analytics-insight">
          <Lightbulb size={22} className="analytics-insight-bulb" aria-hidden />
          <p>
            <strong>Insight for Sri Lankan Parents:</strong> Humidity levels are higher than average
            today. Consider adjusting the nursery ventilation to improve sleep comfort.
          </p>
        </div>
      </div>

      <DashboardFooter />

      <CryAlertDetailModal
        open={detailEvent != null}
        onClose={() => setDetailEvent(null)}
        onAcknowledge={() => navigate('/dashboard/alert-escalation')}
        reason={detailEvent?.reason}
        confidence={detailEvent?.confidence}
        temperature={detailEvent?.temp}
        humidity={detailEvent?.humidity}
        light={detailEvent?.light ?? '—'}
        motion={detailEvent?.motion}
      />
    </div>
  );
}
