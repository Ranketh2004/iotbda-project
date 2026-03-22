import React, { useMemo } from 'react';

/** Smooth area + dashed line chart — last 24h labels */
export default function EnvironmentTrends({ temperature, humidity }) {
  const w = 560;
  const h = 220;
  const pad = { t: 16, r: 16, b: 36, l: 8 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const { tempPath, tempArea, humPath } = useMemo(() => {
    const n = 28;
    const ptsT = [];
    const ptsH = [];
    for (let i = 0; i <= n; i++) {
      const x = pad.l + (i / n) * innerW;
      const t = i / n;
      const tempBase = 22 + Math.sin(t * Math.PI * 2.2) * 3 + (t > 0.55 ? Math.sin((t - 0.55) * 14) * 2 : 0);
      const humBase = 42 + Math.sin(t * Math.PI * 1.8 + 0.5) * 8;
      const yT = pad.t + innerH - ((tempBase - 18) / 14) * innerH * 0.85;
      const yH = pad.t + innerH - ((humBase - 30) / 40) * innerH * 0.7;
      ptsT.push({ x, y: yT });
      ptsH.push({ x, y: yH });
    }

    const lineT = ptsT.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineT} L ${ptsT[ptsT.length - 1].x.toFixed(1)} ${pad.t + innerH} L ${ptsT[0].x.toFixed(1)} ${pad.t + innerH} Z`;

    let dH = `M ${ptsH[0].x.toFixed(1)} ${ptsH[0].y.toFixed(1)}`;
    for (let i = 1; i < ptsH.length; i++) {
      const p = ptsH[i];
      dH += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }

    return { tempPath: lineT, tempArea: areaD, humPath: dH };
  }, []);

  const labels = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM', 'NOW'];

  return (
    <section className="dash-chart-card">
      <div className="dash-chart-head">
        <div>
          <h3 className="dash-chart-title">Environment Trends</h3>
          <p className="dash-chart-sub">Last 24 hours sensor data</p>
        </div>
        <div className="dash-chart-legend">
          <span>
            <i className="legend-dot solid" /> Temp
          </span>
          <span>
            <i className="legend-dot outline" /> Humidity
          </span>
        </div>
      </div>
      <div className="dash-chart-svg-wrap">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="dash-chart-svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Temperature and humidity over 24 hours"
        >
          <defs>
            <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={tempArea} fill="url(#tempFill)" />
          <path d={tempPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d={humPath}
            fill="none"
            stroke="#93c5fd"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
        </svg>
        <div className="dash-chart-xlabels">
          {labels.map((lb) => (
            <span key={lb}>{lb}</span>
          ))}
        </div>
      </div>
      {(temperature != null || humidity != null) && (
        <p className="dash-chart-live">
          Live: {temperature != null ? `${Number(temperature).toFixed(1)}°C` : '—'} temp ·{' '}
          {humidity != null ? `${Number(humidity).toFixed(0)}%` : '—'} humidity
        </p>
      )}
    </section>
  );
}
