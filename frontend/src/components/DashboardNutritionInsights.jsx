import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Droplets, TrendingUp, PieChart } from 'lucide-react';
import { buildNutritionDashboardSummaries } from '../utils/analyticsData';

/** Soft pastel water bands (baby nursery palette). */
const WATER_ORDER = ['low', 'adequate', 'high', 'unknown'];
const WATER_FILL = {
  low: '#fda4af',
  adequate: '#93c5fd',
  high: '#86efac',
  unknown: '#e2e8f0',
};
const WATER_LABEL = {
  low: 'Low',
  adequate: 'Adequate',
  high: 'High',
  unknown: 'Other',
};

const CRY_BAR_FILL = '#c4b5fd';

const BABY_PIE_COLORS = ['#fbcfe8', '#bae6fd', '#bbf7d0', '#fde68a', '#ddd6fe', '#fecdd3', '#a5f3fc'];

function labelizeKey(k) {
  return String(k || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function countsToSlices(counts) {
  const entries = Object.entries(counts || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  return entries.map(([k, v], i) => ({
    key: k,
    label: labelizeKey(k),
    value: v,
    color: BABY_PIE_COLORS[i % BABY_PIE_COLORS.length],
  }));
}

function PieChartSvg({ slices, title, size = 128 }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return <p className="dash-nutrition-empty">No data</p>;
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  let angle = -Math.PI / 2;
  const paths = [];
  slices.forEach((d) => {
    if (!d.value) return;
    const sweep = (d.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    paths.push(
      <path key={d.key} className="dash-nutrition-pie-slice" d={pathD} fill={d.color} strokeWidth="1.25">
        <title>{`${d.label}: ${d.value}`}</title>
      </path>,
    );
  });
  return (
    <div className="dash-nutrition-pie-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        {paths}
      </svg>
      <ul className="dash-nutrition-pie-legend">
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <li key={s.key}>
              <span className="dash-nutrition-swatch" style={{ background: s.color }} aria-hidden />
              <span className="dash-nutrition-pie-legend-text">
                {s.label} <span className="dash-nutrition-pie-legend-val">({s.value})</span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function DashboardNutritionInsights() {
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();
  const summary = useMemo(() => buildNutritionDashboardSummaries(), []);

  const dominantLabel =
    summary.ok && summary.dominantWaterLatest
      ? WATER_LABEL[summary.dominantWaterLatest] || labelizeKey(summary.dominantWaterLatest)
      : 'Not enough data';

  const nutritionSlices = useMemo(
    () => (summary.ok ? countsToSlices(summary.nutritionMix) : []),
    [summary],
  );

  return (
    <section className="dash-timeline-card dash-nutrition-root" aria-labelledby="dash-nutrition-heading">
      <div className="dash-timeline-head">
        <div className="dash-timeline-head-text">
          <h3 id="dash-nutrition-heading" className="dash-timeline-title">
            Baby wellness (sample diary)
          </h3>
        </div>
        <button
          type="button"
          className="dash-timeline-collapse"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={panelId}
          title={expanded ? 'Collapse section' : 'Expand section'}
        >
          {expanded ? <ChevronUp size={22} strokeWidth={2.2} /> : <ChevronDown size={22} strokeWidth={2.2} />}
        </button>
      </div>
      <div className="dash-timeline-desc">
        <p className="dash-timeline-desc-lead">
          Three quick views from <strong>infant_cry_nutrition_data.csv</strong> (cohort rows aligned like your other
          charts). For patterns only, not medical advice.
        </p>
      </div>
      {expanded && (
        <div id={panelId} className="dash-nutrition-panel">
          {!summary.ok ? (
            <p className="dash-nutrition-empty">{summary.message}</p>
          ) : (
            <>
              <p className="dash-nutrition-meta">
                Sample: <strong>{summary.rowCount}</strong> rows, <strong>{summary.uniqueBabies}</strong> babies.
              </p>
              <div className="dash-nutrition-grid">
                <article className="dash-nutrition-tile">
                  <div className="dash-nutrition-tile-head">
                    <Droplets size={18} className="dash-nutrition-tile-ico" aria-hidden />
                    <h4 className="dash-nutrition-tile-title">Water tags by day</h4>
                  </div>
                  <p className="dash-nutrition-tile-lead">
                    Last week in the sample. Newest day <strong>{summary.latestDateLabel}</strong>: most often{' '}
                    <strong>{dominantLabel}</strong>.
                  </p>
                  <div className="dash-nutrition-legend">
                    {WATER_ORDER.filter((k) => k !== 'unknown' || summary.waterByDay.some((d) => d.unknown > 0)).map(
                      (k) => (
                        <span key={k} className="dash-nutrition-legend-item">
                          <span className="dash-nutrition-swatch" style={{ background: WATER_FILL[k] }} />
                          {WATER_LABEL[k]}
                        </span>
                      ),
                    )}
                  </div>
                  <svg
                    className="dash-nutrition-svg"
                    viewBox="0 0 320 120"
                    role="img"
                    aria-label="Water intake labels stacked by cohort diary day"
                  >
                    {summary.waterByDay.map((d, idx) => {
                      const n = summary.waterByDay.length || 1;
                      const bw = 280 / n - 6;
                      const x = 20 + idx * (280 / n) + 3;
                      let yCol = 100;
                      const scale = 85 / Math.max(summary.maxWaterStack, 1);
                      return (
                        <g key={d.date}>
                          {WATER_ORDER.map((key) => {
                            const v = d[key];
                            if (!v) return null;
                            const h = v * scale;
                            yCol -= h;
                            return (
                              <rect
                                key={key}
                                x={x}
                                y={yCol}
                                width={bw}
                                height={Math.max(h, 1)}
                                fill={WATER_FILL[key]}
                                rx={3}
                              >
                                <title>{`${d.label}: ${WATER_LABEL[key]} ${v}`}</title>
                              </rect>
                            );
                          })}
                          <text x={x + bw / 2} y="115" textAnchor="middle" className="dash-nutrition-svg-label">
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </article>

                <article className="dash-nutrition-tile">
                  <div className="dash-nutrition-tile-head">
                    <TrendingUp size={18} className="dash-nutrition-tile-ico" aria-hidden />
                    <h4 className="dash-nutrition-tile-title">Cries per day</h4>
                  </div>
                  <p className="dash-nutrition-tile-lead">
                    Average cry count for each diary date (last {summary.cryByDay.length} days in the window).
                  </p>
                  <svg
                    className="dash-nutrition-svg"
                    viewBox="0 0 320 120"
                    role="img"
                    aria-label="Average cry frequency by cohort diary day"
                  >
                    {summary.cryByDay.map((d, idx) => {
                      const n = summary.cryByDay.length || 1;
                      const bw = 270 / n - 4;
                      const x = 25 + idx * (270 / n) + 2;
                      const h = (d.avgCry / summary.maxCry) * 78;
                      return (
                        <g key={d.date}>
                          <rect
                            x={x}
                            y={98 - h}
                            width={bw}
                            height={Math.max(h, 2)}
                            fill={CRY_BAR_FILL}
                            rx={4}
                          >
                            <title>{`${d.label}: avg ${d.avgCry} cries (${d.n} rows)`}</title>
                          </rect>
                          <text x={x + bw / 2} y="112" textAnchor="middle" className="dash-nutrition-svg-label">
                            {d.label.split(' ')[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </article>

                <article className="dash-nutrition-tile">
                  <div className="dash-nutrition-tile-head">
                    <PieChart size={18} className="dash-nutrition-tile-ico" aria-hidden />
                    <h4 className="dash-nutrition-tile-title">Nutrition level</h4>
                  </div>
                  <p className="dash-nutrition-tile-lead">How often each estimated nutrition tag appears.</p>
                  <PieChartSvg slices={nutritionSlices} title="Estimated nutrition level distribution" size={132} />
                </article>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
