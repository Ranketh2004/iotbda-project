import React, { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X, Volume2 } from 'lucide-react';

/**
 * Full-screen cry alert popup with alarm sound.
 * Shown when baby crying is detected from the real-time audio stream.
 */
export default function CryAlertPopup({ alert, onDismiss }) {
  const audioCtxRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const intervalRef = useRef(null);

  // Generate alarm sound using Web Audio API (no external files needed)
  const startAlarm = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const playBeep = () => {
        // Two-tone alarm: alternating 800Hz and 600Hz
        const now = ctx.currentTime;

        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.value = i % 2 === 0 ? 800 : 600;
          gain.gain.setValueAtTime(0.3, now + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.2);
          osc.stop(now + i * 0.2 + 0.2);
          oscillatorsRef.current.push(osc);
        }
      };

      // Play immediately, then repeat every 1.5s
      playBeep();
      intervalRef.current = setInterval(playBeep, 1500);
    } catch (e) {
      console.error('[Alarm] Could not start alarm sound:', e);
    }
  }, []);

  const stopAlarm = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    oscillatorsRef.current.forEach((osc) => {
      try { osc.stop(); } catch (_) {}
    });
    oscillatorsRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (alert) {
      startAlarm();
    }
    return () => stopAlarm();
  }, [alert, startAlarm, stopAlarm]);

  const handleDismiss = () => {
    stopAlarm();
    onDismiss();
  };

  if (!alert) return null;

  const time = alert.timestamp
    ? new Date(alert.timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <div className="cry-popup-overlay" onClick={handleDismiss}>
      <div className="cry-popup" onClick={(e) => e.stopPropagation()}>
        <button className="cry-popup-close" onClick={handleDismiss}>
          <X size={20} />
        </button>

        <div className="cry-popup-icon">
          <AlertTriangle size={48} />
        </div>

        <h2 className="cry-popup-title">Baby Crying Detected!</h2>
        <p className="cry-popup-message">
          {alert.message || 'Your baby needs attention.'}
        </p>
        <span className="cry-popup-time">{time}</span>

        <div className="cry-popup-sound-indicator">
          <Volume2 size={16} />
          <span>Alarm playing...</span>
        </div>

        <button className="cry-popup-dismiss" onClick={handleDismiss}>
          Dismiss Alert
        </button>
      </div>
    </div>
  );
}
