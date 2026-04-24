import React, { useMemo } from 'react';
import {
  lensReasonHistogramFromCryLabels,
  lensReasonBreakdownFromCryLabels,
  LENS_GRID_ORDER,
} from '../utils/analyticsData';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** Top three buckets by count — same totals as the grid (Mongo cry_label only). */
function topBarRowsFromHistogram(hist) {
  const total = hist.reduce((s, h) => s + h.count, 0);
  if (!total) return null;
  const bars = ['long', 'mid', 'mid2'];
  return [...hist]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((h, i) => ({
      label: LENS_GRID_ORDER.find(([s]) => s === h.reason)?.[1] ?? h.reason,
      pct: Math.round((h.count / total) * 100),
      bar: bars[i] ?? 'mid2',
    }));
}

/** Placeholder grid when nothing is labeled yet */
const EMPTY_GRID_PCTS = {
  belly_pain: 0,
  burping: 0,
  cold_hot: 0,
  discomfort: 0,
  hungry: 0,
  tired: 0,
};

export default function CryPredictionPanel({ notifications }) {
  const hist = useMemo(() => lensReasonHistogramFromCryLabels(notifications || []), [notifications]);

  const breakdown = useMemo(() => lensReasonBreakdownFromCryLabels(notifications || []), [notifications]);

  const main = useMemo(() => topBarRowsFromHistogram(hist), [hist]);

  const gridPct = (slug) => {
    if (!breakdown.total) return EMPTY_GRID_PCTS[slug] ?? 0;
    return Math.round((breakdown.counts[slug] / breakdown.total) * 100);
  };

  return (
    <section className="dash-cry-card">
      <h3 className="dash-cry-title">Cry reason lens</h3>
      <p className="dash-cry-sub">
        Share of loaded notifications that have a multiclass cry_label in MongoDB (last fetch window). Cohort CSV rows
        are not mixed into this chart.
      </p>
      {main && (
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
      )}
      <div className="dash-cry-grid dash-cry-grid--tags">
        {LENS_GRID_ORDER.map(([slug, label]) => (
          <div key={slug} className="dash-cry-cell">
            {label}: {gridPct(slug)}%
          </div>
        ))}
      </div>
      {!breakdown.total && (
        <p className="dash-cry-hint">
          No multiclass cry_label on notifications in this window (binary cry/no_cry labels are ignored). Load more
          history or wait for labeled alerts.
        </p>
      )}
    </section>
  );
}
