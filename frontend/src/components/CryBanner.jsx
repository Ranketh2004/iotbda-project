import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function CryBanner({ cryStatus }) {
  const isCrying = cryStatus?.cry_detected;

  return (
    <div className={`cry-banner ${isCrying ? 'alert' : 'safe'}`}>
      <div className="cry-banner-icon">
        {isCrying ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
      </div>
      <div className="cry-banner-text">
        <h3>{isCrying ? 'Baby Crying Detected!' : 'Baby is Calm'}</h3>
        <p>{cryStatus?.message || 'Monitoring audio stream...'}</p>
      </div>
    </div>
  );
}
