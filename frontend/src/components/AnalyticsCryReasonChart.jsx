import React, { useMemo } from 'react';

export default function AnalyticsCryReasonChart({
  histogram,
  title = 'What we guessed baby needed',
  subtitle = 'How often each reason showed up in recent alerts (best estimate, not a diagnosis).',
}) {
  const rows = histogram?.length ? histogram : [{ reason: 'No data', count: 0 }];
  const max = Math.max(...rows.map((r) => r.count), 1);
  const w = 400;
  const rowH = 28;
  const padL = 120;
  const padR = 36;
  const h = rows.length * rowH + 24;

  const bars = useMemo(() => {
    return rows.map((r, i) => {
      const y = 16 + i * rowH;
      const bw = ((r.count / max) * (w - padL - padR)).toFixed(1);
      return { ...r, y, bw };
    });
  }, [rows, max, w, padL, padR]);

  return (
    <section className="analytics-viz-card" aria-label={title}>
      <h2 className="analytics-viz-title">{title}</h2>
      <p className="analytics-viz-sub">{subtitle}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="analytics-viz-svg" role="img">
        {bars.map((b) => (
          <g key={b.reason}>
            <text x="0" y={b.y + 14} className="analytics-viz-label">
              {b.reason.length > 16 ? `${b.reason.slice(0, 14)}…` : b.reason}
            </text>
            <rect
              x={padL}
              y={b.y}
              width={b.bw}
              height={rowH - 8}
              rx="6"
              className="analytics-viz-bar"
            />
            <text x={w - 8} y={b.y + 14} textAnchor="end" className="analytics-viz-count">
              {b.count}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}
