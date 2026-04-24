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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import CryAlertDetailModal from '../components/CryAlertDetailModal';
import AnalyticsCryReasonChart from '../components/AnalyticsCryReasonChart';
import AnalyticsAlertDensityChart from '../components/AnalyticsAlertDensityChart';
import AnalyticsSensorCorrelationPanel from '../components/AnalyticsSensorCorrelationPanel';
import { fetchSensorHistory, fetchNotifications } from '../services/api';
import {
  mergeSensorHistory,
  mergeNotifications,
  mergeCryEvents,
  getCsvSensorHistory,
  getCsvNotifications,
  getCsvCryEvents,
  formatEventTime,
  avgHumidity,
  computeAnalyticsSummary,
  reasonHistogramFromCryLabels,
} from '../utils/analyticsData';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Urgent' },
  { id: 'mild', label: 'Mild' },
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
  const [recentAlertsOpen, setRecentAlertsOpen] = useState(true);
  const [mergedSensors, setMergedSensors] = useState([]);
  const [mergedEvents, setMergedEvents] = useState([]);
  const [mergedNotifs, setMergedNotifs] = useState([]);

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
      setMergedNotifs(mn);
      setMergedEvents(ev);
    } catch (e) {
      console.error('[analytics]', e);
      const csvS = getCsvSensorHistory();
      const csvN = getCsvNotifications();
      const csvCry = getCsvCryEvents();
      const ms = mergeSensorHistory([], csvS);
      const mn = mergeNotifications([], csvN);
      setMergedSensors(ms);
      setMergedNotifs(mn);
      setMergedEvents(mergeCryEvents(csvCry, mn, ms));
    }
  }, []);

  useEffect(() => {
    loadMerge();
    const id = setInterval(loadMerge, 60000);
    return () => clearInterval(id);
  }, [loadMerge]);

  const summary = useMemo(
    () => computeAnalyticsSummary(mergedEvents, mergedSensors, mergedNotifs),
    [mergedEvents, mergedSensors, mergedNotifs],
  );
  const histogram = useMemo(() => reasonHistogramFromCryLabels(mergedNotifs), [mergedNotifs]);
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
      return `Humidity has been around ${humAvg.toFixed(
        0,
      )}% lately, on the high side for many nurseries. A little airflow, a dehumidifier, or running AC on dry mode before sleep can help the room feel less “sticky” and may reduce fussy spells tied to feeling too damp.`;
    }
    if (humAvg != null) {
      return `Humidity near ${humAvg.toFixed(
        0,
      )}% is in a comfortable range for most babies. If the weather swings, keep an eye on the live readings so you can adjust clothing or the room before naps.`;
    }
    return 'Connect the nursery sensor or check back after more readings so we can give humidity-based tips. The charts below still show patterns from your alerts and any sample data we have.';
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
    <>
      <div className="analytics-page">
        <div className="analytics-shell">
        <header className="analytics-page-head">
          <h1 className="analytics-title">How things have been going</h1>
         
        </header>

        <div className="analytics-stats">
          <article className="analytics-stat-card">
            <UtensilsCrossed size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Most common “why”</p>
            <p className="analytics-stat-value">{summary.topReason}</p>
            <p className="analytics-stat-neutral">{summary.topTrend}</p>
          </article>
          <article className="analytics-stat-card">
            <AlertOctagon size={22} className="analytics-stat-card-ico" />
            <p className="analytics-stat-label">Alerts in the last day</p>
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
            <p className="analytics-stat-label">Room air snapshot</p>
            <p className="analytics-stat-value">{summary.avgResponseLabel}</p>
            <p className="analytics-stat-neutral">{summary.avgResponseDetail}</p>
          </article>
        </div>

        <AnalyticsSensorCorrelationPanel sensors={mergedSensors} />

        <div className="analytics-viz-grid">
          <AnalyticsCryReasonChart
            histogram={histogram}
            title="What we guessed baby needed"
            subtitle="How often each reason showed up in recent alerts (best estimate, not a diagnosis)."
          />
          <AnalyticsAlertDensityChart events={mergedEvents} hours={48} />
        </div>

        <section className={`analytics-recent${recentAlertsOpen ? '' : ' analytics-recent--collapsed'}`}>
          <div className="analytics-recent-head">
            <div className="analytics-recent-head-left">
              <button
                type="button"
                id="analytics-recent-toggle"
                className="analytics-recent-toggle"
                aria-expanded={recentAlertsOpen}
                aria-controls="analytics-recent-panel"
                onClick={() => setRecentAlertsOpen((v) => !v)}
              >
                {recentAlertsOpen ? (
                  <ChevronUp size={20} className="analytics-recent-toggle-ico" aria-hidden />
                ) : (
                  <ChevronDown size={20} className="analytics-recent-toggle-ico" aria-hidden />
                )}
                <span className="visually-hidden">
                  {recentAlertsOpen ? 'Collapse recent alerts' : 'Expand recent alerts'}
                </span>
              </button>
              <h2 className="analytics-recent-title" id="analytics-recent-heading">
                Recent alerts
              </h2>
              {!recentAlertsOpen && (
                <span className="analytics-recent-collapsed-hint" aria-live="polite">
                  {visibleEvents.length} {visibleEvents.length === 1 ? 'alert' : 'alerts'}
                </span>
              )}
            </div>
            {recentAlertsOpen && (
              <div className="analytics-recent-tools">
                <button type="button" className="analytics-date-btn">
                  {todayLabel}
                </button>
                <div className="analytics-filter" role="group" aria-label="Filter alerts by urgency">
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
            )}
          </div>

          {recentAlertsOpen && (
            <div id="analytics-recent-panel" role="region" aria-labelledby="analytics-recent-heading">
              <ul className="analytics-event-list">
                {visibleEvents.map((ev) => (
                  <li key={ev.id} className="analytics-event-card">
                    <div className="analytics-event-top">
                      <EventIcon type={ev.icon} tone={ev.iconTone} />
                      <div className="analytics-event-main">
                        <div className="analytics-event-title-row">
                          <span className="analytics-event-reason">{ev.reason}</span>
                          <span className={`analytics-badge analytics-badge--${ev.confidenceVariant}`}>
                            {ev.confidence}% sure
                          </span>
                        </div>
                        <p className="analytics-event-time">{ev.time}</p>
                      </div>
                      <div className="analytics-event-metrics">
                        <div className="analytics-metric">
                          <Thermometer size={14} className="analytics-metric-ico" />
                          <span className="analytics-metric-label">Temp</span>
                          <span className="analytics-metric-val">{ev.temp}</span>
                        </div>
                        <div className="analytics-metric">
                          <Droplets size={14} className="analytics-metric-ico" />
                          <span className="analytics-metric-label">Humidity</span>
                          <span className="analytics-metric-val">{ev.humidity}</span>
                        </div>
                        {ev.light != null && (
                          <div className="analytics-metric">
                            <span className="analytics-metric-ico-wrap">
                              <LightIcon kind={ev.lightIcon} />
                            </span>
                            <span className="analytics-metric-label">Light</span>
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
                          <span className="analytics-esc-badge">Escalation started</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="analytics-details-link"
                        onClick={() => setDetailEvent(ev)}
                      >
                        Details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="analytics-insight">
          <Lightbulb size={22} className="analytics-insight-bulb" aria-hidden />
          <p>
            <strong>One takeaway:</strong> {insightText}
          </p>
        </div>
        </div>
      </div>

      <CryAlertDetailModal
        open={detailEvent != null}
        onClose={() => setDetailEvent(null)}
        onAcknowledge={() => navigate('/dashboard/alert-escalation')}
        liveCry={false}
        allowManualSms={false}
        reason={detailEvent?.reason}
        confidence={detailEvent?.confidence}
        temperature={detailEvent?.temp}
        humidity={detailEvent?.humidity}
        light={detailEvent?.light ?? '-'}
        motion={detailEvent?.motion}
      />
    </>
  );
}
