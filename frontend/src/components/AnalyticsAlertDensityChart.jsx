import React, { useMemo } from 'react';
import { hourlyCryBuckets } from '../utils/analyticsData';

export default function AnalyticsAlertDensityChart({ events, hours = 48 }) {
  const bins = useMemo(() => hourlyCryBuckets(events, hours), [events, hours]);
  const w = 520;
  const h = 160;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...bins.map((b) => b.count), 1);
  const barW = innerW / bins.length - 2;

  return (
    <section className="analytics-viz-card" aria-label="When cry alerts happened by hour">
      <h2 className="analytics-viz-title">When alerts happened</h2>
      <p className="analytics-viz-sub">
        Last {hours} hours, hour by hour—taller bars mean more alerts in that hour (your device time).
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="analytics-viz-svg" role="img">
        {bins.map((b, i) => {
          const bh = (b.count / max) * innerH;
          const x = pad.l + i * (innerW / bins.length) + 1;
          const y = pad.t + innerH - bh;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(2, barW)}
              height={Math.max(b.count ? 2 : 0, bh)}
              rx="2"
              fill={b.count > 0 ? '#60a5fa' : '#e2e8f0'}
              opacity={b.count > 0 ? 0.9 : 0.35}
            >
              <title>{`${b.label}: ${b.count} alert(s)`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="analytics-density-foot">Hover a bar to see the exact count for that hour.</div>
    </section>
  );
}
