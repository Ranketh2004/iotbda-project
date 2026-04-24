import React, { useMemo } from 'react';
import {
  lensReasonHistogram,
  lensReasonBreakdown,
  LENS_GRID_ORDER,
} from '../utils/analyticsData';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function defaultRows(crying) {
  if (crying) {
    return [
      { label: 'SILENCE / PEACE', pct: 15, bar: 'short' },
      { label: 'HUNGRY', pct: 48, bar: 'mid' },
      { label: 'TIRED', pct: 32, bar: 'mid2' },
    ];
  }
  return [
    { label: 'SILENCE / PEACE', pct: 82, bar: 'long' },
    { label: 'HUNGRY', pct: 12, bar: 'short' },
    { label: 'TIRED', pct: 4, bar: 'tiny' },
  ];
}

/** Map merged cry reasons to the three-row UI; remaining mass in SILENCE / PEACE. */
function fromDistribution(hist, crying) {
  if (!hist?.length) return null;
  const map = Object.fromEntries(hist.map((h) => [h.reason, h.count]));
  const hungry = map['Hungry'] || 0;
  const tired = map['Tired / Sleepy'] || 0;
  const discomfort = map['Discomfort'] || 0;
  const other = Math.max(0, hist.reduce((s, h) => s + h.count, 0) - hungry - tired - discomfort);
  const total = hungry + tired + discomfort + other || 1;
  const hungryPct = Math.round((hungry / total) * 100);
  const tiredPct = Math.round((tired / total) * 100);
  const discomfortPct = Math.round((discomfort / total) * 100);
  const peace = clamp(100 - hungryPct - tiredPct - Math.max(discomfortPct, Math.round((other / total) * 100)), 0, 100);
  if (crying) {
    return [
      { label: 'SILENCE / PEACE', pct: clamp(Math.round(peace * 0.35), 5, 40), bar: 'short' },
      { label: 'HUNGRY', pct: Math.max(hungryPct, 28), bar: 'mid' },
      { label: 'TIRED', pct: Math.max(tiredPct, 18), bar: 'mid2' },
    ];
  }
  return [
    { label: 'SILENCE / PEACE', pct: clamp(Math.max(peace, 55), 40, 92), bar: 'long' },
    { label: 'HUNGRY', pct: clamp(hungryPct || 8, 4, 40), bar: 'short' },
    { label: 'TIRED', pct: clamp(tiredPct || 4, 2, 35), bar: 'tiny' },
  ];
}

/** Demo grid when no merged events yet */
const EMPTY_GRID_PCTS = {
  Discomfort: 2,
  'Belly pain': 1,
  Burping: 1,
  'Cold/Hot': 0,
  'Cry alert': 0,
  Other: 0,
};

export default function CryPredictionPanel({ cryStatus, events }) {
  const crying = cryStatus?.cry_detected;

  const hist = useMemo(() => {
    const list = events || [];
    if (!list.length) return null;
    return lensReasonHistogram(list);
  }, [events]);

  const breakdown = useMemo(() => lensReasonBreakdown(events || []), [events]);

  const main = useMemo(() => {
    const fromHist = fromDistribution(hist, crying);
    if (fromHist) return fromHist;
    return defaultRows(crying);
  }, [crying, hist]);

  const gridPct = (slug) => {
    if (!breakdown.total) return EMPTY_GRID_PCTS[slug] ?? 0;
    return Math.round((breakdown.counts[slug] / breakdown.total) * 100);
  };

  return (
    <section className="dash-cry-card">
      <h3 className="dash-cry-title">Cry reason lens</h3>
      <p className="dash-cry-sub">
        All model-style tags with share of merged events (Burping, Belly pain, Cold/Hot, etc.)
      </p>
      <ul className="dash-cry-rows">
        {main.map((row) => (
          <li key={row.label} className="dash-cry-row">
            <span className="dash-cry-label">{row.label}</span>
            <div className="dash-cry-bar-track">
              <span
                className={`dash-cry-bar-fill ${row.bar === 'long' ? 'primary' : 'muted'}`}
                style={{ width: `${clamp(row.pct, 0, 100)}%` }}
              />
            </div>
            <span className="dash-cry-pct">{row.pct}%</span>
          </li>
        ))}
      </ul>
      <div className="dash-cry-grid dash-cry-grid--tags">
        {LENS_GRID_ORDER.map(([slug, label]) => (
          <div key={slug} className="dash-cry-cell">
            {label}: {gridPct(slug)}%
          </div>
        ))}
      </div>
      {!breakdown.total && (
        <p className="dash-cry-hint">Connect data to replace demo shares above with live counts.</p>
      )}
    </section>
  );
}
