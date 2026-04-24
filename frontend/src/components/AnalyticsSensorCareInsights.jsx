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
      <section className="analytics-sensor-insights analytics-sensor-insights--error" aria-label="Nursery snapshot error">
        <p className="analytics-sensor-insights-title">Today’s snapshot from the nursery</p>
        <p className="analytics-sensor-insights-err">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="analytics-sensor-insights" aria-label="Today’s nursery snapshot">
        <p className="analytics-sensor-insights-title">Today’s snapshot from the nursery</p>
        <p className="analytics-sensor-insights-muted">Loading…</p>
      </section>
    );
  }

  const src = data.sources || {};
  const foot = `From ${src.sensor_samples ?? 0} room readings and ${src.cry_alerts ?? 0} cry alerts for ${data.entry_date} (your local time: ${tz}).`;

  return (
    <section className="analytics-sensor-insights" aria-label="Today’s nursery snapshot">
      <div className="analytics-sensor-insights-head">
        <h2 className="analytics-sensor-insights-title">Today’s snapshot from the nursery</h2>
        <p className="analytics-sensor-insights-sub">
          Pulled from your live monitor and sensor. These same numbers help pre-fill your <strong>Daily care</strong>{' '}
          log so you spend less time typing.
        </p>
      </div>
      <div className="analytics-sensor-insights-grid">
        <article className="analytics-sensor-tile">
          <Frown size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Cries today (rough count)</p>
          <p className="analytics-sensor-tile-value">{data.cry_frequency}</p>
          <p className="analytics-sensor-tile-hint">From cry alerts we saw</p>
        </article>
        <article className="analytics-sensor-tile">
          <Clock size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Busiest time for cries</p>
          <p className="analytics-sensor-tile-value">{labelize(data.time_of_day_peak_cry)}</p>
          <p className="analytics-sensor-tile-hint">When most alerts happened</p>
        </article>
        <article className="analytics-sensor-tile">
          <Activity size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">Movement in the crib</p>
          <p className="analytics-sensor-tile-value">{labelize(data.motion_activity_level)}</p>
          <p className="analytics-sensor-tile-hint">
            {src.motion_fraction != null
              ? `Baby was moving in about ${Math.round(src.motion_fraction * 100)}% of readings`
              : 'No movement data yet'}
          </p>
        </article>
        <article className="analytics-sensor-tile">
          <Waves size={20} className="analytics-sensor-tile-ico" aria-hidden />
          <p className="analytics-sensor-tile-label">How “big” cries sounded</p>
          <p className="analytics-sensor-tile-value">{labelize(data.cry_intensity_avg)}</p>
          <p className="analytics-sensor-tile-hint">From how alerts were described</p>
        </article>
      </div>
      <p className="analytics-sensor-insights-foot">{foot}</p>
    </section>
  );
}
