import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
import AnalyticsCryReasonChart from '../components/AnalyticsCryReasonChart';
import AnalyticsAlertDensityChart from '../components/AnalyticsAlertDensityChart';
import AnalyticsSensorCareInsights from '../components/AnalyticsSensorCareInsights';
import { fetchSensorHistory, fetchNotifications } from '../services/api';
import {
  mergeSensorHistory,
  mergeNotifications,
  mergeCryEvents,
  getCsvSensorHistory,
  getCsvNotifications,
  getCsvCryEvents,
  reasonHistogram,
  formatEventTime,
  avgHumidity,
  computeAnalyticsSummary,
} from '../utils/analyticsData';

const FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'critical', label: 'CRITICAL' },
  { id: 'mild', label: 'MILD' },
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
  const [mergedSensors, setMergedSensors] = useState([]);
  const [mergedEvents, setMergedEvents] = useState([]);

  const loadMerge = useCallback(async () => {
    try {
      const [histRes, notifRes] = await Promise.all([
        fetchSensorHistory(200).catch(() => ({ data: [] })),
        fetchNotifications(120).catch(() => ({ notifications: [] })),
      ]);
      const mongoS = histRes?.data || [];
      const mongoN = notifRes?.notifications || [];
      const csvS = getCsvSensorHistory();
      const csvN = getCsvNotifications();
      const csvCry = getCsvCryEvents();
      const ms = mergeSensorHistory(mongoS, csvS);
      const mn = mergeNotifications(mongoN, csvN);
      const ev = mergeCryEvents(csvCry, mn, ms);
      setMergedSensors(ms);
      setMergedEvents(ev);
    } catch (e) {
      console.error('[analytics]', e);
      const csvS = getCsvSensorHistory();
      const csvN = getCsvNotifications();
      const csvCry = getCsvCryEvents();
      const ms = mergeSensorHistory([], csvS);
      const mn = mergeNotifications([], csvN);
      setMergedSensors(ms);
      setMergedEvents(mergeCryEvents(csvCry, mn, ms));
    }
  }, []);

  useEffect(() => {
    loadMerge();
    const id = setInterval(loadMerge, 60000);
    return () => clearInterval(id);
  }, [loadMerge]);

  const summary = useMemo(
    () => computeAnalyticsSummary(mergedEvents, mergedSensors),
    [mergedEvents, mergedSensors],
  );
  const histogram = useMemo(() => reasonHistogram(mergedEvents), [mergedEvents]);
  const visibleEvents = useMemo(() => {
    const list = mergedEvents.map((e) => ({
      ...e,
      time: formatEventTime(e.timestamp),
    }));
    if (filter === 'all') return list;
    if (filter === 'critical') return list.filter((e) => e.severity === 'critical');
    return list.filter((e) => e.severity === 'mild');
  }, [mergedEvents, filter]);

  const humAvg = avgHumidity(mergedSensors);
  const insightText = useMemo(() => {
    if (humAvg != null && humAvg > 71) {
      return `Humidity is averaging about ${humAvg.toFixed(
        0,
      )}% in the merged window (live MongoDB + nutrition cohort CSV). Ventilation or dry mode before sleep often reduces discomfort-tagged cries in tropical climates.`;
    }
    if (humAvg != null) {
      return `Humidity near ${humAvg.toFixed(
        0,
      )}% sits in a comfortable band for most infants. Keep comparing against live readings as weather shifts.`;
    }
    return 'Merge more sensor rows from the device to tighten environment insights; the nutrition cohort CSV still fills the chart meanwhile.';
  }, [humAvg]);

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Today';
    }
  }, []);

  return (
    <div className="dash-page analytics-page">
      <DashboardHeader />

      <div className="analytics-shell">
        <header className="analytics-page-head">
          <h1 className="analytics-title">Care analytics</h1>
          <p className="analytics-subtitle">
            Interactive dashboards grounded in merged data: your MongoDB collections (sensor_data, notifications)
            plus infant_cry_nutrition_data.csv (daily cry frequency and feeding context, time-aligned for charts).
            Use the nursery coach chat from the dashboard for conversational exploration.
          </p>
        </header>

        <div className="analytics-stats">
          <article className="analytics-stat-card">
            <UtensilsCrossed size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Leading reason</p>
            <p className="analytics-stat-value">{summary.topReason}</p>
            <p className="analytics-stat-neutral">{summary.topTrend}</p>
          </article>
          <article className="analytics-stat-card">
            <AlertOctagon size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Alerts (last 24h)</p>
            <p className="analytics-stat-value">{summary.alertsToday}</p>
            <p
              className={
                summary.alertsTrend === 'up'
                  ? 'analytics-stat-trend analytics-stat-trend--up'
                  : summary.alertsTrend === 'down'
                    ? 'analytics-stat-trend analytics-stat-trend--down'
                    : 'analytics-stat-neutral'
              }
            >
              {summary.alertsTrend === 'up' ? (
                <TrendingUp size={14} />
              ) : summary.alertsTrend === 'down' ? (
                <TrendingDown size={14} />
              ) : null}{' '}
              {summary.alertsTrendLabel}
            </p>
          </article>
          <article className="analytics-stat-card">
            <Timer size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Environment cue</p>
            <p className="analytics-stat-value">{summary.avgResponseLabel}</p>
            <p className="analytics-stat-neutral">{summary.avgResponseDetail}</p>
          </article>
        </div>

        <AnalyticsSensorCareInsights />

        <div className="analytics-viz-grid">
          <AnalyticsCryReasonChart histogram={histogram} />
          <AnalyticsAlertDensityChart events={mergedEvents} hours={48} />
        </div>

        <section className="analytics-recent">
          <div className="analytics-recent-head">
            <h2 className="analytics-recent-title">Cry-style events</h2>
            <div className="analytics-recent-tools">
              <button type="button" className="analytics-date-btn">
                {todayLabel}
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
                      <span className={`analytics-badge analytics-badge--${ev.confidenceVariant}`}>
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
                    {ev.footerMid && <span className="analytics-foot-mid">{ev.footerMid}</span>}
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
            <strong>Decision-support insight:</strong> {insightText}
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
