import React, { useMemo } from 'react';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export default function CryPredictionPanel({ cryStatus }) {
  const crying = cryStatus?.cry_detected;

  const main = useMemo(() => {
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
  }, [crying]);

  const extras = [
    { label: 'BELLY PAIN', pct: 1 },
    { label: 'BURPING', pct: 1 },
    { label: 'COLD/HOT', pct: 0 },
    { label: 'DISCOMFORT', pct: 0 },
  ];

  return (
    <section className="dash-cry-card">
      <h3 className="dash-cry-title">Cry Reason Prediction</h3>
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
      <p className="dash-cry-hint">Historical probabilities based on voice analysis:</p>
      <div className="dash-cry-grid">
        {extras.map((e) => (
          <div key={e.label} className="dash-cry-cell">
            {e.label}: {e.pct}%
          </div>
        ))}
      </div>
    </section>
  );
}
