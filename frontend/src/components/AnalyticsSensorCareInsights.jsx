import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock, Frown, Waves } from 'lucide-react';
import { fetchCareLogSuggestions } from '../services/api';
import { clientIanaTimezone, todayLocalIso } from '../constants/careLogOptions';

function labelize(slug) {
  return String(slug || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnalyticsSensorCareInsights() {
  const tz = useMemo(() => clientIanaTimezone(), []);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('cryguard_token'));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const token = localStorage.getItem('cryguard_token');
      setAuthed(!!token);
      if (!token) {
        setData(null);
        setError(null);
        return;
      }
      try {
        const sug = await fetchCareLogSuggestions(tz, todayLocalIso());
        if (!cancelled) {
          setData(sug);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e.message || 'Could not load sensor-derived insights.');
        }
      }
    };
    run();
    const id = setInterval(run, 120000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tz]);

  if (!authed) {
    return null;
  }

  if (error) {
    return (
      <section className="analytics-sensor-insights analytics-sensor-insights--error" aria-label="Sensor care insights">
        <p className="analytics-sensor-insights-title">Today’s sensor-derived care signals</p>
        <p className="analytics-sensor-insights-err">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="analytics-sensor-insights" aria-label="Sensor care insights">
        <p className="analytics-sensor-insights-title">Today’s sensor-derived care signals</p>
        <p className="analytics-sensor-insights-muted">Loading…</p>
      </section>
    );
  }

  const src = data.sources || {};
  const foot = `Based on ${src.sensor_samples ?? 0} sensor samples and ${src.cry_alerts ?? 0} cry alerts in MongoDB for ${data.entry_date} (${tz}).`;

  return (
    <section className="analytics-sensor-insights" aria-label="Sensor care insights">
      <div className="analytics-sensor-insights-head">
        <h2 className="analytics-sensor-insights-title">Today’s sensor-derived care signals</h2>
        <p className="analytics-sensor-insights-sub">
          Same metrics used to autofill your <strong>Daily care</strong> form — from live nursery data.
        </p>
      </div>
      <div className="analytics-sensor-insights-grid">
        <article className="analytics-sensor-tile">
          <Frown size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Cry frequency (today)</p>
          <p className="analytics-sensor-tile-value">{data.cry_frequency}</p>
          <p className="analytics-sensor-tile-hint">Cry alerts in window</p>
        </article>
        <article className="analytics-sensor-tile">
          <Clock size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Peak cry window</p>
          <p className="analytics-sensor-tile-value">{labelize(data.time_of_day_peak_cry)}</p>
          <p className="analytics-sensor-tile-hint">Most alerts in this part of day</p>
        </article>
        <article className="analytics-sensor-tile">
          <Activity size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Motion / activity</p>
          <p className="analytics-sensor-tile-value">{labelize(data.motion_activity_level)}</p>
          <p className="analytics-sensor-tile-hint">
            {src.motion_fraction != null ? `${Math.round(src.motion_fraction * 100)}% motion-on samples` : 'No motion samples'}
          </p>
        </article>
        <article className="analytics-sensor-tile">
          <Waves size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Avg. cry intensity</p>
          <p className="analytics-sensor-tile-value">{labelize(data.cry_intensity_avg)}</p>
          <p className="analytics-sensor-tile-hint">From alert wording</p>
        </article>
      </div>
      <p className="analytics-sensor-insights-foot">{foot}</p>
    </section>
  );
}
