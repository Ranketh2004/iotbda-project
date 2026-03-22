import React, { useEffect, useState } from 'react';
import {
  Brain,
  BellOff,
  CheckCircle2,
  Phone,
  Headphones,
  Info,
  Thermometer,
  Droplets,
  Moon,
  Radio,
} from 'lucide-react';

const DEFAULTS = {
  reason: 'Hungry',
  confidence: 85,
  temperature: '24°C',
  humidity: '45%',
  light: 'Dark',
  motion: 'Detected',
  subtitle: 'Nursery Room • Audio & Motion trigger',
};

function formatCountdown(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CryAlertDetailModal({
  open,
  onClose,
  onAcknowledge,
  reason,
  confidence,
  temperature,
  humidity,
  light,
  motion,
  subtitle,
}) {
  const [secs, setSecs] = useState(30);

  const r = reason ?? DEFAULTS.reason;
  const conf = confidence ?? DEFAULTS.confidence;
  const temp = temperature ?? DEFAULTS.temperature;
  const hum = humidity ?? DEFAULTS.humidity;
  const lt = light ?? DEFAULTS.light;
  const mot = motion ?? DEFAULTS.motion;
  const sub = subtitle ?? DEFAULTS.subtitle;

  useEffect(() => {
    if (!open) return undefined;
    setSecs(30);
    const id = window.setInterval(() => {
      setSecs((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cry-detail-overlay" onClick={onClose} role="presentation">
      <div
        className="cry-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cry-detail-title"
      >
        <div className="cry-detail-head">
          <div className="cry-detail-head-left">
            <span className="cry-detail-live-badge">
              <span className="cry-detail-live-dot" aria-hidden />
              LIVE STATUS: ALERT ACTIVE
            </span>
            <h2 id="cry-detail-title" className="cry-detail-title">
              Baby Cry Detected
            </h2>
            <p className="cry-detail-sub">{sub}</p>
          </div>
          <div className="cry-detail-countdown-wrap">
            <div className="cry-detail-countdown-box" aria-live="polite">
              {formatCountdown(secs)}
            </div>
            <span className="cry-detail-countdown-label">Escalating in</span>
          </div>
        </div>

        <div className="cry-detail-ai">
          <span className="cry-detail-ai-ico" aria-hidden>
            <Brain size={22} strokeWidth={2} />
          </span>
          <div className="cry-detail-ai-main">
            <p className="cry-detail-ai-label">AI insight: likely reason</p>
            <p className="cry-detail-ai-reason">{r}</p>
          </div>
          <div className="cry-detail-ai-score">
            <span className="cry-detail-ai-pct">{conf}%</span>
            <span className="cry-detail-ai-conf-label">Confidence</span>
          </div>
        </div>

        <div className="cry-detail-sensors">
          <div className="cry-detail-sensor">
            <Thermometer size={16} className="cry-detail-sensor-ico" aria-hidden />
            <span className="cry-detail-sensor-label">Temperature</span>
            <span className="cry-detail-sensor-val">{temp}</span>
          </div>
          <div className="cry-detail-sensor">
            <Droplets size={16} className="cry-detail-sensor-ico" aria-hidden />
            <span className="cry-detail-sensor-label">Humidity</span>
            <span className="cry-detail-sensor-val">{hum}</span>
          </div>
          <div className="cry-detail-sensor">
            <Moon size={16} className="cry-detail-sensor-ico" aria-hidden />
            <span className="cry-detail-sensor-label">Light</span>
            <span className="cry-detail-sensor-val">{lt}</span>
          </div>
          <div className="cry-detail-sensor">
            <Radio size={16} className="cry-detail-sensor-ico" aria-hidden />
            <span className="cry-detail-sensor-label">Motion</span>
            <span className="cry-detail-sensor-val">{mot}</span>
          </div>
        </div>

        <button type="button" className="cry-detail-stop" onClick={onClose}>
          <BellOff size={20} strokeWidth={2} />
          Stop Alarm
        </button>

        <div className="cry-detail-actions-grid">
          <button
            type="button"
            className="cry-detail-btn cry-detail-btn--primary"
            onClick={() => {
              onAcknowledge?.();
              onClose();
            }}
          >
            <CheckCircle2 size={18} strokeWidth={2} />
            Acknowledge
          </button>
          <button type="button" className="cry-detail-btn cry-detail-btn--outline">
            <Phone size={18} strokeWidth={2} />
            Call Parent 2
          </button>
          <button type="button" className="cry-detail-btn cry-detail-btn--outline">
            <Headphones size={18} strokeWidth={2} />
            Call Guardian 1
          </button>
          <button type="button" className="cry-detail-btn cry-detail-btn--outline">
            <Phone size={18} strokeWidth={2} />
            Call Guardian 2
          </button>
        </div>

        <div className="cry-detail-footer-note">
          <Info size={16} className="cry-detail-footer-ico" aria-hidden />
          <p>
            Escalation protocol: If no parent responds within 30 seconds, alert will be sent to
            Guardian 1 (Sarah), then Guardian 2 (James) after 2 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
