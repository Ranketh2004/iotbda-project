import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Loader2,
} from 'lucide-react';
import { acknowledgeCryAlert, sendCryEscalationSms } from '../services/api';

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

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function hasSmsCapablePhone(phone) {
  return digitsOnly(phone).length >= 8;
}

export default function CryAlertDetailModal({
  open,
  onClose,
  onAcknowledge,
  liveCry = false,
  allowManualSms = false,
  sessionUser = null,
  activeAlertMessage = '',
  cryLabel = '',
  reason,
  confidence,
  temperature,
  humidity,
  light,
  motion,
  subtitle,
  cryMaxProb,
}) {
  const [secs, setSecs] = useState(30);
  const [smsBusy, setSmsBusy] = useState(null);
  const [smsError, setSmsError] = useState('');
  const [smsOk, setSmsOk] = useState('');
  const audioCtxRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  const mother = sessionUser?.mother || {};
  const father = sessionUser?.father || {};
  const guardians = Array.isArray(sessionUser?.guardians) ? sessionUser.guardians : [];
  const gSorted = [...guardians].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const g1 = gSorted[0];
  const g2 = gSorted[1];

  const hasParent2 = hasSmsCapablePhone(father.phone);
  const hasGuardian1 = hasSmsCapablePhone(g1?.phone);
  const hasGuardian2 = hasSmsCapablePhone(g2?.phone);

  const confPct =
    typeof confidence === 'number' && !Number.isNaN(confidence)
      ? Math.round(Math.min(100, Math.max(0, confidence)))
      : typeof cryMaxProb === 'number' && cryMaxProb > 0 && cryMaxProb <= 1
        ? Math.round(cryMaxProb * 100)
        : DEFAULTS.confidence;

  const r = reason ?? DEFAULTS.reason;
  const temp = temperature ?? DEFAULTS.temperature;
  const hum = humidity ?? DEFAULTS.humidity;
  const lt = light ?? DEFAULTS.light;
  const mot = motion ?? DEFAULTS.motion;
  const sub = subtitle ?? DEFAULTS.subtitle;

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    }
  }, []);

  const startAlarm = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const playBeep = () => {
        const now = ctx.currentTime;
        for (let i = 0; i < 3; i += 1) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = i % 2 === 0 ? 800 : 600;
          gain.gain.setValueAtTime(0.28, now + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.2);
          osc.stop(now + i * 0.2 + 0.2);
        }
      };
      playBeep();
      alarmIntervalRef.current = window.setInterval(playBeep, 1500);
    } catch (e) {
      console.error('[CryAlertModal] alarm:', e);
    }
  }, []);

  useEffect(() => {
    if (!open || !liveCry) {
      stopAlarm();
      return undefined;
    }
    startAlarm();
    return () => stopAlarm();
  }, [open, liveCry, startAlarm, stopAlarm]);

  useEffect(() => {
    if (!open) return undefined;
    setSecs(30);
    setSmsError('');
    setSmsOk('');
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

  const handleManualSms = async (target) => {
    if (!allowManualSms) return;
    setSmsBusy(target);
    setSmsError('');
    setSmsOk('');
    try {
      await sendCryEscalationSms(target, {
        message: activeAlertMessage || undefined,
        cry_label: cryLabel || undefined,
      });
      setSmsOk('SMS sent.');
    } catch (e) {
      setSmsError(e?.message || 'SMS failed');
    } finally {
      setSmsBusy(null);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await acknowledgeCryAlert();
    } catch {
      /* still close UI if ack endpoint fails */
    }
    stopAlarm();
    onAcknowledge?.();
    onClose();
  };

  const handleStopAlarm = () => {
    stopAlarm();
    onClose();
  };

  const parent2Label = father.name?.trim() ? `SMS Parent 2 (${father.name.trim()})` : 'SMS Parent 2';
  const g1Label = g1?.name?.trim() ? `SMS Guardian 1 (${g1.name.trim()})` : 'SMS Guardian 1';
  const g2Label = g2?.name?.trim() ? `SMS Guardian 2 (${g2.name.trim()})` : 'SMS Guardian 2';

  const g1Name = g1?.name?.trim() || 'Guardian 1';
  const g2Name = g2?.name?.trim() || 'Guardian 2';

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
              {liveCry ? 'LIVE STATUS: ALERT ACTIVE' : 'Nursery status'}
            </span>
            <h2 id="cry-detail-title" className="cry-detail-title">
              {liveCry ? 'Baby Cry Detected' : 'Alert details'}
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
            <span className="cry-detail-ai-pct">{confPct}%</span>
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

        <button type="button" className="cry-detail-stop" onClick={handleStopAlarm}>
          <BellOff size={20} strokeWidth={2} />
          Stop Alarm
        </button>

        {(smsError || smsOk) && (
          <p className={`cry-detail-sms-feedback ${smsError ? 'cry-detail-sms-feedback--err' : ''}`} role="status">
            {smsError || smsOk}
          </p>
        )}

        <div className="cry-detail-actions-grid">
          <button type="button" className="cry-detail-btn cry-detail-btn--primary" onClick={handleAcknowledge}>
            <CheckCircle2 size={18} strokeWidth={2} />
            Acknowledge
          </button>
          <button
            type="button"
            className="cry-detail-btn cry-detail-btn--outline"
            disabled={!allowManualSms || !hasParent2 || smsBusy}
            title={!hasParent2 ? 'Add Parent 2 phone in Settings' : 'Send SMS to Parent 2'}
            onClick={() => handleManualSms('parent2')}
          >
            {smsBusy === 'parent2' ? <Loader2 size={18} className="cry-detail-btn-spin" /> : <Phone size={18} strokeWidth={2} />}
            {parent2Label}
          </button>
          <button
            type="button"
            className="cry-detail-btn cry-detail-btn--outline"
            disabled={!allowManualSms || !hasGuardian1 || smsBusy}
            title={!hasGuardian1 ? 'Add Guardian 1 in Settings' : 'Send SMS to Guardian 1'}
            onClick={() => handleManualSms('guardian1')}
          >
            {smsBusy === 'guardian1' ? <Loader2 size={18} className="cry-detail-btn-spin" /> : <Headphones size={18} strokeWidth={2} />}
            {g1Label}
          </button>
          <button
            type="button"
            className="cry-detail-btn cry-detail-btn--outline"
            disabled={!allowManualSms || !hasGuardian2 || smsBusy}
            title={!hasGuardian2 ? 'Add a second guardian in Settings' : 'Send SMS to Guardian 2'}
            onClick={() => handleManualSms('guardian2')}
          >
            {smsBusy === 'guardian2' ? <Loader2 size={18} className="cry-detail-btn-spin" /> : <Phone size={18} strokeWidth={2} />}
            {g2Label}
          </button>
        </div>

        <div className="cry-detail-footer-note">
          <Info size={16} className="cry-detail-footer-ico" aria-hidden />
          <p>
            Escalation protocol: SMS goes first to Parent 1 (mother or primary phone on file). If you do not
            acknowledge within 30 seconds, an SMS is sent to Guardian 1 ({g1Name}), then to Guardian 2 ({g2Name})
            after 2 minutes. Use the buttons above to SMS Parent 2 or guardians immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
