import React, { useCallback, useMemo, useState } from 'react';
import {
  Bell,
  Radio,
  Thermometer,
  Users,
  Plus,
  AlertCircle,
  Info,
  MoreVertical,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import DashboardFooter from '../components/DashboardFooter';

const LEVELS = ['Low', 'Medium', 'High'];

const INITIAL_GUARDIANS = [
  { id: '1', name: 'Sarah Mitchell', role: 'Primary Caregiver', initials: 'SM', tone: 'blue' },
  { id: '2', name: 'David Miller', role: 'Secondary Contact', initials: 'DM', tone: 'gray' },
  { id: '3', name: 'Elena Hunt', role: 'Grandparent', initials: 'EH', tone: 'gray' },
];

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const INITIAL = {
  push: true,
  email: false,
  sms: true,
  cryLevel: 'Low',
  motionLevel: 'Medium',
  tempMin: 20,
  tempMax: 24,
  humMin: 40,
  humMax: 60,
  escalationMin: 5,
  guardians: INITIAL_GUARDIANS,
};

function SectionHead({ icon: Icon, children, action }) {
  return (
    <div className="alert-set-card-head">
      <h2 className="alert-set-card-title">
        <span className="alert-set-card-ico" aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </span>
        {children}
      </h2>
      {action}
    </div>
  );
}

export default function AlertSettingsPage() {
  const [form, setForm] = useState(() => cloneDeep(INITIAL));
  const [saved, setSaved] = useState(() => cloneDeep(INITIAL));

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  const setTempMin = (v) => {
    const n = Number(v);
    setForm((f) => {
      const lo = Math.min(n, f.tempMax - 1);
      return { ...f, tempMin: lo };
    });
  };

  const setTempMax = (v) => {
    const n = Number(v);
    setForm((f) => {
      const hi = Math.max(n, f.tempMin + 1);
      return { ...f, tempMax: hi };
    });
  };

  const setHumMin = (v) => {
    const n = Number(v);
    setForm((f) => {
      const lo = Math.min(n, f.humMax - 5);
      return { ...f, humMin: lo };
    });
  };

  const setHumMax = (v) => {
    const n = Number(v);
    setForm((f) => {
      const hi = Math.max(n, f.humMin + 5);
      return { ...f, humMax: hi };
    });
  };

  const handleSave = useCallback(() => {
    setSaved(cloneDeep(form));
  }, [form]);

  const handleDiscard = useCallback(() => {
    setForm(cloneDeep(saved));
  }, [saved]);

  const tempPct = (t) => ((t - 16) / (32 - 16)) * 100;
  const humPct = (h) => ((h - 20) / (80 - 20)) * 100;

  return (
    <div className="dash-page settings-page">
      <DashboardHeader />
      <div className="analytics-shell alert-set-shell">
        <header className="analytics-page-head">
          <h1 className="analytics-title">Alert Settings</h1>
          <p className="analytics-subtitle">
            Customize how your Infant Cry Guard monitors and notifies you.
          </p>
          <p className="alert-set-back-wrap">
            <Link to="/dashboard/notifications" className="alert-set-back">
              ← Back to notification history
            </Link>
          </p>
        </header>

        <div className="alert-set-grid-top">
          <section className="settings-card alert-set-card">
            <SectionHead icon={Bell}>Notification Preferences</SectionHead>
            <div className="alert-set-toggles">
              <div className="alert-set-toggle-row">
                <div>
                  <p className="alert-set-toggle-label">Push Notifications</p>
                  <p className="alert-set-toggle-hint">Instant alerts on your mobile device.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.push}
                  className={`settings-toggle ${form.push ? 'on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, push: !f.push }))}
                >
                  <span className="settings-toggle-knob" />
                </button>
              </div>
              <div className="alert-set-toggle-row">
                <div>
                  <p className="alert-set-toggle-label">Email Alerts</p>
                  <p className="alert-set-toggle-hint">Summary reports and logs.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.email}
                  className={`settings-toggle ${form.email ? 'on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, email: !f.email }))}
                >
                  <span className="settings-toggle-knob" />
                </button>
              </div>
              <div className="alert-set-toggle-row">
                <div>
                  <p className="alert-set-toggle-label">SMS Alerts</p>
                  <p className="alert-set-toggle-hint">Urgent text message notifications.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.sms}
                  className={`settings-toggle ${form.sms ? 'on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, sms: !f.sms }))}
                >
                  <span className="settings-toggle-knob" />
                </button>
              </div>
            </div>
          </section>

          <section className="settings-card alert-set-card">
            <SectionHead icon={Radio}>Sensitivity Levels</SectionHead>
            <div className="alert-set-sensitivity">
              <p className="alert-set-sens-label">Cry Detection</p>
              <div className="alert-set-segmented" role="group" aria-label="Cry detection sensitivity">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`alert-set-seg-btn ${form.cryLevel === lvl ? 'active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, cryLevel: lvl }))}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="alert-set-sens-label">Motion Detection</p>
              <div className="alert-set-segmented" role="group" aria-label="Motion detection sensitivity">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`alert-set-seg-btn ${form.motionLevel === lvl ? 'active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, motionLevel: lvl }))}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="settings-card alert-set-card alert-set-card--wide">
          <SectionHead icon={Thermometer}>Environmental Thresholds</SectionHead>
          <div className="alert-set-env">
            <div className="alert-set-range-block">
              <div className="alert-set-range-head">
                <span className="alert-set-range-badge">
                  {form.tempMin}°C - {form.tempMax}°C
                </span>
              </div>
              <div className="alert-set-dual-track">
                <div
                  className="alert-set-dual-fill"
                  style={{
                    left: `${tempPct(form.tempMin)}%`,
                    width: `${tempPct(form.tempMax) - tempPct(form.tempMin)}%`,
                  }}
                />
                <input
                  type="range"
                  className="alert-set-range-input alert-set-range-input--min"
                  min={16}
                  max={32}
                  value={form.tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                  aria-label="Minimum temperature"
                />
                <input
                  type="range"
                  className="alert-set-range-input alert-set-range-input--max"
                  min={16}
                  max={32}
                  value={form.tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  aria-label="Maximum temperature"
                />
              </div>
              <p className="alert-set-range-hint">
                Receive alerts when temperature drifts outside this range.
              </p>
            </div>
            <div className="alert-set-range-block">
              <div className="alert-set-range-head">
                <span className="alert-set-range-badge">
                  {form.humMin}% - {form.humMax}%
                </span>
              </div>
              <div className="alert-set-dual-track">
                <div
                  className="alert-set-dual-fill alert-set-dual-fill--hum"
                  style={{
                    left: `${humPct(form.humMin)}%`,
                    width: `${humPct(form.humMax) - humPct(form.humMin)}%`,
                  }}
                />
                <input
                  type="range"
                  className="alert-set-range-input alert-set-range-input--min"
                  min={20}
                  max={80}
                  value={form.humMin}
                  onChange={(e) => setHumMin(e.target.value)}
                  aria-label="Minimum humidity"
                />
                <input
                  type="range"
                  className="alert-set-range-input alert-set-range-input--max"
                  min={20}
                  max={80}
                  value={form.humMax}
                  onChange={(e) => setHumMax(e.target.value)}
                  aria-label="Maximum humidity"
                />
              </div>
              <p className="alert-set-range-hint">
                Optimal humidity levels promote better sleep for infants.
              </p>
            </div>
          </div>
        </section>

        <div className="alert-set-grid-bottom">
          <section className="settings-card alert-set-card">
            <SectionHead
              icon={Users}
              action={
                <button type="button" className="alert-set-add-link">
                  <Plus size={16} strokeWidth={2.5} />
                  Add New
                </button>
              }
            >
              Guardians
            </SectionHead>
            <ul className="alert-set-guardian-list">
              {form.guardians.map((g) => (
                <li key={g.id} className="alert-set-guardian-row">
                  <span
                    className={`alert-set-guardian-avatar ${g.tone === 'blue' ? 'alert-set-guardian-avatar--primary' : ''}`}
                    aria-hidden
                  >
                    {g.initials}
                  </span>
                  <div className="alert-set-guardian-meta">
                    <p className="alert-set-guardian-name">{g.name}</p>
                    <p className="alert-set-guardian-role">{g.role}</p>
                  </div>
                  <button type="button" className="alert-set-guardian-menu" aria-label={`Options for ${g.name}`}>
                    <MoreVertical size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="settings-card alert-set-card">
            <SectionHead icon={AlertCircle}>Alert Escalation</SectionHead>
            <div className="alert-set-escalation">
              <p className="alert-set-escalation-title">Escalation Delay</p>
              <p className="alert-set-escalation-desc">
                If the primary guardian doesn&apos;t dismiss an alert, how long should we wait before
                notifying other guardians?
              </p>
              <div className="alert-set-escalation-slider">
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={form.escalationMin}
                  onChange={(e) => setForm((f) => ({ ...f, escalationMin: Number(e.target.value) }))}
                  className="alert-set-single-slider"
                  aria-valuetext={`${form.escalationMin} minutes`}
                />
                <span className="alert-set-escalation-value">{form.escalationMin} Min</span>
              </div>
            </div>
            <div className="alert-set-tip">
              <Info size={18} className="alert-set-tip-ico" aria-hidden />
              <p>
                <strong>Safety Tip:</strong> We recommend a 2-minute escalation delay for critical cry
                alerts at night.
              </p>
            </div>
          </section>
        </div>

        <footer className="alert-set-footer">
          <button type="button" className="settings-btn-text" onClick={handleDiscard} disabled={!dirty}>
            Discard Changes
          </button>
          <button type="button" className="settings-btn-primary" onClick={handleSave} disabled={!dirty}>
            Save All Changes
          </button>
        </footer>
      </div>
      <DashboardFooter />
    </div>
  );
}
