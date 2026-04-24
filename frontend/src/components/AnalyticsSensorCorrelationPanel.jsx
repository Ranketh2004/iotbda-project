import React, { useMemo } from 'react';
import { computeSensorCorrelationAnalysis } from '../utils/analyticsData';

function corrCellBg(r) {
  if (r == null) return 'transparent';
  const a = Math.min(Math.abs(r), 1);
  const t = (a * 0.55).toFixed(3);
  if (r >= 0) return `rgba(59, 130, 246, ${t})`;
  return `rgba(244, 63, 94, ${t})`;
}

function strengthWord(r) {
  if (r == null) return '';
  const a = Math.abs(r);
  if (a >= 0.55) return 'strong';
  if (a >= 0.25) return 'moderate';
  return 'weak';
}

export default function AnalyticsSensorCorrelationPanel({ sensors }) {
  const analysis = useMemo(() => computeSensorCorrelationAnalysis(sensors), [sensors]);

  return (
    <section className="analytics-corr-card" aria-labelledby="analytics-corr-title">
      <div className="analytics-corr-head">
        <h2 id="analytics-corr-title" className="analytics-corr-title">
          How temperature, humidity, and movement line up
        </h2>
        
      </div>

      {!analysis.ok && (
        <p className="analytics-corr-muted" role="status">
          {analysis.message}
          {analysis.n != null && analysis.n > 0 && (
            <span className="analytics-corr-n"> (we have {analysis.n} readings so far)</span>
          )}
        </p>
      )}

      {analysis.ok && (
        <>
         

          <p className="analytics-corr-legend" role="note">
            In the grid below: numbers closer to <strong>1</strong> mean two things often rise or fall together;
            near <strong>0</strong> means little connection. Gentle <strong>blue</strong> shading = more together,{' '}
            <strong>red</strong> = more opposite.
          </p>

          <div className="analytics-corr-layout">
            <div className="analytics-corr-block">
              <h3 className="analytics-corr-block-title">Reading pairs side by side</h3>
              <div className="analytics-corr-table-wrap">
                <table className="analytics-corr-table">
                  <thead>
                    <tr>
                      <th className="analytics-corr-th-corner" />
                      {analysis.shortLabels.map((lab) => (
                        <th key={lab} className="analytics-corr-th">
                          {lab}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.shortLabels.map((rowLab, i) => (
                      <tr key={rowLab}>
                        <th className="analytics-corr-th-row">{rowLab}</th>
                        {analysis.matrix[i].map((cell, j) => (
                          <td
                            key={`${i}-${j}`}
                            className="analytics-corr-td"
                            style={{ background: corrCellBg(cell) }}
                          >
                            {cell == null ? '-' : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-corr-block">
              <h3 className="analytics-corr-block-title">Strongest links</h3>
              <ol className="analytics-corr-pairs">
                {analysis.pairs.map((p) => (
                  <li key={`${p.a}-${p.b}`} className="analytics-corr-pair">
                    <span className="analytics-corr-pair-label">
                      {p.a} and {p.b}
                    </span>
                    <span className="analytics-corr-pair-r">
                      {p.r == null ? '-' : `${p.r > 0 ? '+' : ''}${p.r}`}
                      {p.r != null && (
                        <span className="analytics-corr-pair-note"> ({strengthWord(p.r)} link)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>

              <h3 className="analytics-corr-block-title analytics-corr-block-title--spaced">
                What tends to move with humidity
              </h3>
              <p className="analytics-corr-block-lead">
                Rough ranking from the same readings, useful for “what might we tweak in the room?”, not for
                medical decisions.
              </p>
              <ul className="analytics-corr-bars" aria-label="Factors that line up most with humidity">
                {analysis.importance.map((row) => (
                  <li key={row.feature} className="analytics-corr-bar-row">
                    <div className="analytics-corr-bar-top">
                      <span className="analytics-corr-bar-name">{row.feature}</span>
                      <span className="analytics-corr-bar-meta">
                        About {row.pct}% of this pattern
                        {row.signed !== 0 && (
                          <span className="analytics-corr-bar-dir">
                            {' '}
                            (
                            {row.signed > 0
                              ? 'often wetter air when this reads higher'
                              : 'often drier air when this reads higher'}
                            )
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="analytics-corr-bar-track">
                      <div className="analytics-corr-bar-fill" style={{ width: `${row.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>

              <h3 className="analytics-corr-block-title analytics-corr-block-title--spaced">
                Cooler half of the room vs warmer half
              </h3>
              <p className="analytics-corr-strat">
                We split readings around <strong>{analysis.stratified.threshold}°C</strong>. About half were cooler
                ({analysis.stratified.nBelow} readings) and half were warmer ({analysis.stratified.nAbove}). Average
                humidity was about <strong>{analysis.stratified.meanHumidityBelow}%</strong> on the cooler side and{' '}
                <strong>{analysis.stratified.meanHumidityAbove}%</strong> on the warmer side (a gap of{' '}
                {analysis.stratified.delta >= 0 ? '+' : ''}
                {analysis.stratified.delta} percentage points).
              </p>
            </div>
          </div>

          <p className="analytics-corr-foot">
            If anything here worries you about your baby’s health, trust your pediatrician, not this screen.
          </p>
        </>
      )}
    </section>
  );
}
