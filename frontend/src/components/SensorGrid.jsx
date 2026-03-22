import React from 'react';
import {
  Thermometer,
  Droplets,
  Activity,
  Moon,
  Radio,
} from 'lucide-react';

function barPctTemp(c) {
  if (c == null || Number.isNaN(c)) return 40;
  return Math.min(100, Math.max(8, ((c - 18) / 14) * 100));
}

function barPctHum(p) {
  if (p == null || Number.isNaN(p)) return 30;
  return Math.min(100, Math.max(8, p));
}

function barPctLight(dark) {
  return dark ? 12 : 88;
}

function barPctMotion(motion) {
  return motion ? 72 : 18;
}

export default function SensorGrid({ sensorData }) {
  const temp = sensorData?.temperature;
  const hum = sensorData?.humidity;
  const motion = sensorData?.motion;
  const dark = sensorData?.light_dark;

  const tempStr = temp !== null && temp !== undefined ? `${temp.toFixed(1)}°C` : '—';
  const humStr = hum !== null && hum !== undefined ? `${hum.toFixed(0)}%` : '—';

  return (
    <div className="dash-sensor-grid">
      <div className="dash-sensor-card">
        <div className="dash-sensor-top">
          <span className="dash-sensor-label">TEMPERATURE</span>
          <Thermometer size={18} className="dash-sensor-icon" />
        </div>
        <div className="dash-sensor-value-row">
          <span className="dash-sensor-value">{tempStr}</span>
          <span className="dash-sensor-delta pos">↑1%</span>
        </div>
        <div className="dash-sensor-bar">
          <span className="dash-sensor-bar-fill" style={{ width: `${barPctTemp(temp)}%` }} />
        </div>
      </div>

      <div className="dash-sensor-card">
        <div className="dash-sensor-top">
          <span className="dash-sensor-label">HUMIDITY</span>
          <Droplets size={18} className="dash-sensor-icon" />
        </div>
        <div className="dash-sensor-value-row">
          <span className="dash-sensor-value">{humStr}</span>
          <span className="dash-sensor-delta neutral">−0%</span>
        </div>
        <div className="dash-sensor-bar">
          <span className="dash-sensor-bar-fill" style={{ width: `${barPctHum(hum)}%` }} />
        </div>
      </div>

      <div className="dash-sensor-card">
        <div className="dash-sensor-top">
          <span className="dash-sensor-label">LIGHT LEVEL</span>
          <Moon size={18} className="dash-sensor-icon" />
        </div>
        <div className="dash-sensor-value-row">
          <span className="dash-sensor-value">{dark ? 'Dark' : 'Bright'}</span>
          <span className={`dash-sensor-delta ${dark ? 'warn' : 'neutral'}`}>
            {dark ? '+5%' : '—'}
          </span>
        </div>
        <div className="dash-sensor-bar">
          <span
            className={`dash-sensor-bar-fill ${dark ? 'muted' : ''}`}
            style={{ width: `${barPctLight(dark)}%` }}
          />
        </div>
      </div>

      <div className="dash-sensor-card">
        <div className="dash-sensor-top">
          <span className="dash-sensor-label">MOTION</span>
          <Radio size={18} className="dash-sensor-icon" />
        </div>
        <div className="dash-sensor-value-row">
          <span className="dash-sensor-value">{motion ? 'Detected' : 'None'}</span>
          <span className="dash-sensor-delta neutral">{motion ? 'Active' : 'Stable'}</span>
        </div>
        <div className="dash-sensor-bar dash-sensor-bar--segmented">
          <span
            className="dash-sensor-bar-fill dash-sensor-bar-fill--narrow"
            style={{ left: `${barPctMotion(motion) / 2}%`, width: motion ? '28%' : '12%' }}
          />
        </div>
      </div>
    </div>
  );
}
