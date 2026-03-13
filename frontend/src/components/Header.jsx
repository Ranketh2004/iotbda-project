import React from 'react';
import { Wifi, WifiOff, Baby } from 'lucide-react';

export default function Header({ espConnected }) {
  return (
    <header className="header">
      <div className="header-left">
        <Baby size={32} color="#38bdf8" />
        <h1>Cry<span>Guard</span></h1>
      </div>

      <div className={`connection-badge ${espConnected ? 'connected' : 'disconnected'}`}>
        <span className="status-dot" />
        {espConnected ? (
          <>
            <Wifi size={16} /> ESP32 Connected
          </>
        ) : (
          <>
            <WifiOff size={16} /> ESP32 Disconnected
          </>
        )}
      </div>
    </header>
  );
}
