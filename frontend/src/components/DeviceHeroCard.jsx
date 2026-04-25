import React from 'react';
import { DEFAULT_BABY_PLACEHOLDER_SRC } from '../constants/assets';

export default function DeviceHeroCard({
  espConnected,
  cryStatus,
  babyName,
  babyAgeLabel,
  babyPhotoUrl,
}) {
  const isCrying = cryStatus?.cry_detected;
  const statusLine = isCrying
    ? cryStatus?.message || 'Activity detected'
    : 'Currently Sleeping';

  const displayName = (babyName || '').trim() || 'Your baby';
  const agePart = (babyAgeLabel || '').trim();
  const subLine = agePart ? `${agePart} • ${statusLine}` : statusLine;

  const hasUploadedBabyPhoto = Boolean((babyPhotoUrl || '').trim());
  const imgSrc = hasUploadedBabyPhoto
    ? (babyPhotoUrl || '').trim()
    : DEFAULT_BABY_PLACEHOLDER_SRC;

  return (
    <section className="dash-hero-card">
      <div className="dash-hero-left">
        <div className="dash-baby-photo">
          <img
            src={imgSrc}
            alt=""
            className={`dash-baby-img${hasUploadedBabyPhoto ? '' : ' dash-baby-img--placeholder'}`}
          />
          <span className={`dash-online-dot ${espConnected ? 'on' : 'off'}`} title="Device status" />
        </div>
        <div className="dash-hero-meta">
          <h2 className="dash-baby-name">{displayName}</h2>
          <span className={`dash-device-badge ${espConnected ? 'online' : 'offline'}`}>
            {espConnected ? 'DEVICE ONLINE' : 'DEVICE OFFLINE'}
          </span>
          <p className="dash-baby-sub">{subLine}</p>
        </div>
      </div>
    </section>
  );
}
