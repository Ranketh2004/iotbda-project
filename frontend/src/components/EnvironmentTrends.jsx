import React, { useMemo, useState } from 'react';

/**
 * Dual-axis chart: temperature (left, °C) and humidity (right, % RH) use independent scales
 * so both series are visible; humidity domain gets a minimum span when values are nearly flat.
 */
function expandDomain(min, max, minSpan, padRatio = 0.08) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  let lo = min;
  let hi = max;
  if (hi <= lo) {
    const mid = lo;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  let span = hi - lo;
  if (span < minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
    span = minSpan;
  }
  const pad = span * padRatio;
  return { min: lo - pad, max: hi + pad };
}

function niceTicks(min, max, count) {
  const span = max - min;
  if (span <= 0 || !Number.isFinite(span)) return [min, max];
  const rough = span / Math.max(1, count - 1);
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const inc = [1, 2, 5, 10].map((n) => n * pow10).find((n) => n >= rough / 2) || pow10;
  const start = Math.floor(min / inc) * inc;
  const ticks = [];
  for (let t = start; t <= max + inc * 0.01; t += inc) {
    if (ticks.length >= 8) break;
    ticks.push(Math.round(t * 1000) / 1000);
  }
  if (ticks.length < 2) return [min, max];
  return ticks;
}

export default function EnvironmentTrends({ series, temperature, humidity }) {
  const [rangeHours, setRangeHours] = useState(24);
  /** Show one series at a time for clearer reading */
  const [metric, setMetric] = useState('temperature');
  const w = 560;
  const h = 240;
  const pad = { t: 14, r: 44, b: 36, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const now = Date.now() / 1000;
  const windowSec = rangeHours * 3600;

  const pts = useMemo(() => {
    const raw = (series || [])
      .filter((s) => s?.timestamp != null && s.temperature != null && s.humidity != null)
      .filter((s) => s.timestamp >= now - windowSec)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (raw.length >= 2) return raw;
    const t0 = now - windowSec;
    const t1 = now;
    const t = temperature != null ? Number(temperature) : 27;
    const hu = humidity != null ? Number(humidity) : 68;
    if (raw.length === 1) return [{ ...raw[0] }, { timestamp: t1, temperature: t, humidity: hu, motion: false, light_dark: false }];
    return [
      { timestamp: t0, temperature: t - 0.4, humidity: hu + 2, motion: false, light_dark: true },
      { timestamp: t1, temperature: t, humidity: hu, motion: false, light_dark: false },
    ];
  }, [series, temperature, humidity, now, windowSec]);

  const chart = useMemo(() => {
    const temps = pts.map((p) => p.temperature);
    const hums = pts.map((p) => p.humidity);
    const tDom = expandDomain(Math.min(...temps), Math.max(...temps), 1.5);
    // RH: force at least ~8% span so small sensor drift still reads as a curve, not a hairline
    const hDom = expandDomain(Math.min(...hums), Math.max(...hums), 8);

    const t0 = pts[0].timestamp;
    const t1 = pts[pts.length - 1].timestamp;
    const span = Math.max(t1 - t0, 1);

    const yForTemp = (temp) => {
      const yn = (temp - tDom.min) / (tDom.max - tDom.min || 1);
      return pad.t + innerH - yn * innerH;
    };
    const yForHum = (hum) => {
      const yn = (hum - hDom.min) / (hDom.max - hDom.min || 1);
      return pad.t + innerH - yn * innerH;
    };

    const ptsT = pts.map((p) => ({
      x: pad.l + ((p.timestamp - t0) / span) * innerW,
      y: yForTemp(p.temperature),
      ts: p.timestamp,
    }));
    const ptsH = pts.map((p) => ({
      x: pad.l + ((p.timestamp - t0) / span) * innerW,
      y: yForHum(p.humidity),
    }));

    const lineT = ptsT.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineT} L ${ptsT[ptsT.length - 1].x.toFixed(1)} ${pad.t + innerH} L ${ptsT[0].x.toFixed(1)} ${pad.t + innerH} Z`;
    let dH = `M ${ptsH[0].x.toFixed(1)} ${ptsH[0].y.toFixed(1)}`;
    for (let i = 1; i < ptsH.length; i++) {
      dH += ` L ${ptsH[i].x.toFixed(1)} ${ptsH[i].y.toFixed(1)}`;
    }

    const nLab = 6;
    const labels = [];
    for (let i = 0; i < nLab; i++) {
      const frac = i / (nLab - 1);
      const ts = t0 + frac * span;
      const d = new Date(ts * 1000);
      labels.push(
        d.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }),
      );
    }

    const ann = [];
    for (let i = 1; i < pts.length - 1; i++) {
      if (pts[i].motion && !pts[i - 1].motion) {
        const x = pad.l + ((pts[i].timestamp - t0) / span) * innerW;
        ann.push(x);
      }
    }

    const tempTicks = niceTicks(tDom.min, tDom.max, 4);
    const humTicks = niceTicks(hDom.min, hDom.max, 4);

    return {
      tempPath: lineT,
      tempArea: areaD,
      humPath: dH,
      xLabels: labels,
      annotationXs: ann.slice(0, 6),
      tDom,
      hDom,
      tempTicks,
      humTicks,
      yForTemp,
      yForHum,
      pad,
      innerH,
      innerW,
      t0,
      span,
    };
  }, [pts, innerW, innerH, pad.l, pad.t, pad.r]);

  const humRangeLabel = useMemo(() => {
    const hs = pts.map((p) => p.humidity);
    const lo = Math.min(...hs);
    const hi = Math.max(...hs);
    if (Math.abs(hi - lo) < 0.5) return `Humidity ~${((lo + hi) / 2).toFixed(0)}% (very stable in window)`;
    return `Humidity in view: ${lo.toFixed(0)}–${hi.toFixed(0)}%`;
  }, [pts]);

  const tempRangeLabel = useMemo(() => {
    const ts = pts.map((p) => p.temperature);
    const lo = Math.min(...ts);
    const hi = Math.max(...ts);
    if (Math.abs(hi - lo) < 0.15) return `Temp ~${((lo + hi) / 2).toFixed(1)}°C (very stable in window)`;
    return `Temp in view: ${lo.toFixed(1)}–${hi.toFixed(1)}°C`;
  }, [pts]);

  return (
    <section className="dash-chart-card">
      <div className="dash-chart-head">
        <div>
          <h3 className="dash-chart-title">Environment trends</h3>
          <div className="dash-chart-metric-radios" role="radiogroup" aria-label="Chart metric">
            <label className={`dash-chart-radio ${metric === 'temperature' ? 'dash-chart-radio--active' : ''}`}>
              <input
                type="radio"
                name="env-metric"
                value="temperature"
                checked={metric === 'temperature'}
                onChange={() => setMetric('temperature')}
              />
              <span>Temperature</span>
            </label>
            <label className={`dash-chart-radio ${metric === 'humidity' ? 'dash-chart-radio--active' : ''}`}>
              <input
                type="radio"
                name="env-metric"
                value="humidity"
                checked={metric === 'humidity'}
                onChange={() => setMetric('humidity')}
              />
              <span>Humidity</span>
            </label>
          </div>
        </div>
        <div className="dash-chart-head-actions">
          <div className="dash-chart-range" role="group" aria-label="Time range">
            {[24, 48, 72].map((h) => (
              <button
                key={h}
                type="button"
                className={`dash-chart-range-btn ${rangeHours === h ? 'active' : ''}`}
                onClick={() => setRangeHours(h)}
              >
                {h}h
              </button>
            ))}
          </div>
          <div className="dash-chart-legend">
            {metric === 'temperature' ? (
              <span>
                <i className="legend-dot solid" /> Temp (°C)
              </span>
            ) : (
              <span className="dash-chart-legend-hum">
                <i className="legend-dash-teal" /> Humidity (%)
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="dash-chart-svg-wrap">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="dash-chart-svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={
            metric === 'temperature'
              ? 'Temperature over time from merged dataset'
              : 'Humidity over time from merged dataset'
          }
        >
          <defs>
            <linearGradient id="tempFillDash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Left axis — °C (temperature mode only) */}
          {metric === 'temperature' &&
            chart.tempTicks.map((tv, i) => {
              const y = chart.yForTemp(tv);
              return (
                <g key={`tl-${i}`}>
                  <line
                    x1={chart.pad.l - 4}
                    y1={y}
                    x2={chart.pad.l + chart.innerW}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    opacity="0.9"
                  />
                  <text x={chart.pad.l - 8} y={y + 4} textAnchor="end" className="dash-chart-axis-label">
                    {tv.toFixed(tv % 1 === 0 ? 0 : 1)}
                  </text>
                </g>
              );
            })}

          {/* Right axis — % RH (humidity mode only) */}
          {metric === 'humidity' &&
            chart.humTicks.map((hv, i) => {
              const y = chart.yForHum(hv);
              return (
                <g key={`hr-${i}`}>
                  <line
                    x1={chart.pad.l - 4}
                    y1={y}
                    x2={chart.pad.l + chart.innerW}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    opacity="0.9"
                  />
                  <text
                    x={w - chart.pad.r + 8}
                    y={y + 4}
                    textAnchor="start"
                    className="dash-chart-axis-label dash-chart-axis-label--hum"
                  >
                    {Math.round(hv)}%
                  </text>
                </g>
              );
            })}

          {chart.annotationXs.map((x, i) => (
            <line
              key={i}
              x1={x}
              y1={chart.pad.t + 2}
              x2={x}
              y2={chart.pad.t + chart.innerH}
              stroke="#f472b6"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.35"
            />
          ))}

          {metric === 'temperature' && (
            <>
              <path d={chart.tempArea} fill="url(#tempFillDash)" />
              <path
                d={chart.tempPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {metric === 'humidity' && (
            <path
              d={chart.humPath}
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.75"
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          )}
        </svg>
        <div className="dash-chart-xlabels">
          {chart.xLabels.map((lb, i) => (
            <span key={`${lb}-${i}`}>{lb}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
