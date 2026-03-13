import React from 'react';
import {
  Thermometer,
  Droplets,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';

export default function SensorGrid({ sensorData }) {
  const temp = sensorData?.temperature;
  const hum = sensorData?.humidity;
  const motion = sensorData?.motion;
  const dark = sensorData?.light_dark;

  return (
    <div className="dashboard-grid">
      {/* Temperature */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon temp">
            <Thermometer size={20} />
          </div>
          <span className="card-label">Temperature</span>
        </div>
        <div className="card-value">
          {temp !== null && temp !== undefined ? temp.toFixed(1) : '--'}
          <span className="card-unit">°C</span>
        </div>
      </div>

      {/* Humidity */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon humidity">
            <Droplets size={20} />
          </div>
          <span className="card-label">Humidity</span>
        </div>
        <div className="card-value">
          {hum !== null && hum !== undefined ? hum.toFixed(1) : '--'}
          <span className="card-unit">%</span>
        </div>
      </div>

      {/* Motion */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon motion">
            <Activity size={20} />
          </div>
          <span className="card-label">Motion Sensor</span>
        </div>
        <div className={`card-status ${motion ? 'active' : 'inactive'}`}>
          {motion ? '● Motion Detected' : '● No Motion'}
        </div>
      </div>

      {/* Light */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon light">
            {dark ? <Moon size={20} /> : <Sun size={20} />}
          </div>
          <span className="card-label">Light Level</span>
        </div>
        <div className={`card-status ${dark ? 'dark' : 'bright'}`}>
          {dark ? '● Dark' : '● Bright'}
        </div>
      </div>
    </div>
  );
}
