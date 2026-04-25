import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

const AUDIO_WS_URL = `ws://${window.location.hostname}:8080/ws/audio-listen`;
const SAMPLE_RATE = 16000;
const JITTER_BUFFER_MS = 0.08; // 80ms initial buffer to prevent gaps

export default function ListenButton({ onCryAlert }) {
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [espStreaming, setEspStreaming] = useState(false);
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const chunksReceived = useRef(0);

  const startListening = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnecting(true);
    chunksReceived.current = 0;
    setEspStreaming(false);

    // Create AudioContext on user gesture (required by browsers)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
    });
    audioCtxRef.current = audioCtx;
    nextPlayTimeRef.current = 0;

    // Create a gain node for volume control
    const gain = audioCtx.createGain();
    gain.gain.value = 3.0; // Boost mic volume (INMP441 can be quiet)
    gain.connect(audioCtx.destination);
    gainRef.current = gain;

    const ws = new WebSocket(AUDIO_WS_URL);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[AudioListen] WebSocket connected, waiting for audio...');
      setListening(true);
      setConnecting(false);
    };

    ws.onmessage = (event) => {
      // Handle text messages (handshake + cry alerts)
      if (typeof event.data === 'string') {
        console.log('[AudioListen] Server:', event.data);
        // Check if it's a cry alert JSON
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'cry_alert' && msg.data?.cry_detected && onCryAlert) {
            onCryAlert(msg.data);
          }
        } catch (_) {
          // Not JSON (e.g. "connected" handshake) – ignore
        }
        return;
      }

      if (!audioCtxRef.current || !gainRef.current) return;
      const ctx = audioCtxRef.current;

      // Resume context if suspended (autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Mark that we're receiving audio from ESP32
      chunksReceived.current++;
      if (chunksReceived.current === 1) {
        setEspStreaming(true);
        console.log('[AudioListen] First audio chunk received!');
      }

      // Incoming: raw 16-bit signed PCM, little-endian, mono, 16kHz
      const int16Array = new Int16Array(event.data);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create buffer and schedule playback
      const audioBuffer = ctx.createBuffer(1, float32Array.length, SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainRef.current);

      // Schedule buffers back-to-back with initial jitter buffer
      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now + JITTER_BUFFER_MS;
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
    };

    ws.onclose = () => {
      console.log('[AudioListen] WebSocket disconnected');
      setListening(false);
      setConnecting(false);
      setEspStreaming(false);
    };

    ws.onerror = (err) => {
      console.error('[AudioListen] WebSocket error:', err);
      setConnecting(false);
      ws.close();
    };
  }, []);

  const stopListening = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    gainRef.current = null;
    setListening(false);
    setConnecting(false);
    setEspStreaming(false);
  }, []);

  const toggle = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="listen-section">
      <button
        className={`listen-btn ${listening ? 'active' : ''} ${connecting ? 'connecting' : ''}`}
        onClick={toggle}
        disabled={connecting}
      >
        <div className="listen-btn-icon">
          {listening ? <Volume2 size={22} /> : <Mic size={22} />}
        </div>
        <div className="listen-btn-text">
          <span className="listen-btn-label">
            {connecting
              ? 'Connecting...'
              : listening
                ? (espStreaming ? 'Listening Live' : 'Waiting for ESP32 audio...')
                : 'Listen to Baby'}
          </span>
          <span className="listen-btn-sub">
            {listening
              ? (espStreaming ? 'Real-time audio playing, Click to stop' : 'WebSocket connected, waiting for mic data')
              : 'Stream real-time audio from ESP32 INMP441 mic'}
          </span>
        </div>
        {listening && espStreaming && (
          <div className="listen-visualizer">
            <span className="bar bar1" />
            <span className="bar bar2" />
            <span className="bar bar3" />
            <span className="bar bar4" />
            <span className="bar bar5" />
          </div>
        )}
        <div className="listen-btn-action">
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </div>
      </button>
    </div>
  );
}
