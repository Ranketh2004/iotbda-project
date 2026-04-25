import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  Bell,
  Shield,
  Home,
  Accessibility,
  Phone,
  Star,
  SquarePen,
  Plus,
  SlidersHorizontal,
  Moon,
  ChevronDown,
} from 'lucide-react';
import { useDashboardSession } from '../context/DashboardSessionContext';
import {
  applyThemeToDocument,
  readDarkModeFromStorage,
  writeDarkModeToStorage,
} from '../theme';
import {
  mapApiGuardiansToSettingsForm,
  mapApiUserToProfileForm,
  mapSettingsGuardiansToApiPayload,
} from '../constants/userProfile';

const TIMING_OPTIONS = ['30s', '1m', '2m', '5m'];

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Exactly one primary, listed first; icons match rank (signup convention). */
function withPromotedPrimary(guardians, primaryId) {
  const updated = guardians.map((g) => {
    const isPri = g.id === primaryId;
    return {
      ...g,
      rank: isPri ? 'primary' : 'secondary',
      icon: isPri ? 'accessibility' : 'home',
    };
  });
  const primary = updated.find((x) => x.id === primaryId);
  const rest = updated.filter((x) => x.id !== primaryId);
  return primary ? [primary, ...rest] : updated;
}

/** Current primary becomes secondary; first other guardian in list order becomes primary. */
function demotePrimaryGuardian(guardians, formerPrimaryId) {
  const others = guardians.filter((g) => g.id !== formerPrimaryId);
  if (others.length === 0) return guardians;
  return withPromotedPrimary(guardians, others[0].id);
}

const INITIAL_FORM = {
  parent1: { name: '', phone: '', email: '' },
  parent2: { name: '', phone: '', email: '' },
  escalationEnabled: true,
  escalateAfter: '1m',
  guardians: [],
  language: 'en-US',
  alertSound: 'gentle',
  darkMode: false,
};

function mergeInitialForm() {
  const f = cloneDeep(INITIAL_FORM);
  f.darkMode = readDarkModeFromStorage();
  return f;
}

/** Merge signed-in mother/father (signup / API) into Parent 1 & Parent 2. */
function applyAccountUserToForm(form, user) {
  if (!user || typeof user !== 'object') return form;
  const m = mapApiUserToProfileForm(user);
  return {
    ...form,
    parent1: {
      name: m.motherName || '',
      phone: m.motherPhone || '',
      email: m.motherEmail || '',
    },
    parent2: {
      name: m.fatherName || '',
      phone: m.fatherPhone || '',
      email: m.fatherEmail || '',
    },
    guardians: mapApiGuardiansToSettingsForm(user.guardians),
  };
}

function getInitialSettingsForm() {
  const base = mergeInitialForm();
  try {
    const raw = localStorage.getItem('cryguard_user');
    if (raw) return applyAccountUserToForm(base, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return base;
}

function GuardianIcon({ type }) {
  const cls = 'settings-guardian-avatar';
  if (type === 'home') {
    return (
      <span className={cls} aria-hidden>
        <Home size={18} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden>
      <Accessibility size={18} strokeWidth={2.2} />
    </span>
  );
}

function SectionTitle({ icon: Icon, children, id }) {
  return (
    <h2 className="settings-section-title" id={id}>
      <span className="settings-section-title-ico" aria-hidden>
        <Icon size={20} strokeWidth={2} />
      </span>
      {children}
    </h2>
  );
}

export default function SettingsPage() {
  const { bumpSession } = useDashboardSession();
  const [form, setForm] = useState(() => getInitialSettingsForm());
  const [saved, setSaved] = useState(() => cloneDeep(getInitialSettingsForm()));
  const [editingId, setEditingId] = useState(null);
  const [guardianBusy, setGuardianBusy] = useState(false);
  const [guardianApiError, setGuardianApiError] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('cryguard_token');
    if (!token) return undefined;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const u = await res.json();
        localStorage.setItem('cryguard_user', JSON.stringify(u));
        if (cancelled) return;
        setForm((prev) => applyAccountUserToForm(prev, u));
        setSaved((prev) => applyAccountUserToForm(prev, u));
        bumpSession();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bumpSession]);

  useEffect(() => {
    applyThemeToDocument(form.darkMode);
    writeDarkModeToStorage(form.darkMode);
  }, [form.darkMode]);

  const updateParent = (parent, field, value) => {
    setForm((f) => ({
      ...f,
      [parent]: { ...f[parent], [field]: value },
    }));
  };

  const updateGuardianField = useCallback((id, field, value) => {
    setForm((f) => ({
      ...f,
      guardians: f.guardians.map((g) => (g.id === id ? { ...g, [field]: value } : g)),
    }));
  }, []);

  const persistGuardians = useCallback(async (guardiansList) => {
    const token = localStorage.getItem('cryguard_token');
    if (!token) {
      setForm((f) => ({ ...f, guardians: guardiansList }));
      setSaved((f) => ({ ...f, guardians: cloneDeep(guardiansList) }));
      setGuardianApiError('');
      return true;
    }
    setGuardianBusy(true);
    setGuardianApiError('');
    try {
      const res = await fetch('/api/auth/guardians', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guardians: mapSettingsGuardiansToApiPayload(guardiansList) }),
      });
      if (!res.ok) {
        setGuardianApiError('Could not save guardians. Try again.');
        return false;
      }
      const user = await res.json();
      localStorage.setItem('cryguard_user', JSON.stringify(user));
      bumpSession();
      const nextGuardians = mapApiGuardiansToSettingsForm(user.guardians);
      setForm((f) => ({ ...f, guardians: nextGuardians }));
      setSaved((f) => ({ ...f, guardians: cloneDeep(nextGuardians) }));
      return true;
    } catch {
      setGuardianApiError('Network error. Check your connection.');
      return false;
    } finally {
      setGuardianBusy(false);
    }
  }, [bumpSession]);

  const addGuardian = () => {
    const newbie = {
      id: `g-${Date.now()}`,
      name: 'New guardian',
      role: 'Guardian',
      phone: '',
      rank: 'secondary',
      online: false,
      icon: 'home',
    };
    const next = [...form.guardians, newbie];
    void persistGuardians(next);
  };

  const removeGuardian = async (id) => {
    if (editingId === id) setEditingId(null);
    const next = form.guardians.filter((g) => g.id !== id);
    await persistGuardians(next);
  };

  const saveGuardianEdit = async () => {
    if (!editingId) return;
    const ok = await persistGuardians(form.guardians);
    if (ok) setEditingId(null);
  };

  /** Revert all guardian rows (priority changes can affect more than one card). */
  const cancelGuardianEdit = useCallback(() => {
    setForm((f) => ({
      ...f,
      guardians: cloneDeep(saved.guardians),
    }));
    setEditingId(null);
  }, [saved.guardians]);

  /** Local-only: reorder and ranks until Save. */
  const setGuardianRankInForm = useCallback((id, rank) => {
    setForm((f) => {
      if (rank === 'primary') {
        const cur = f.guardians.find((x) => x.id === id);
        if (!cur || cur.rank === 'primary') return f;
        return { ...f, guardians: withPromotedPrimary(f.guardians, id) };
      }
      const cur = f.guardians.find((x) => x.id === id);
      if (!cur || cur.rank !== 'primary') return f;
      if (f.guardians.length <= 1) return f;
      return { ...f, guardians: demotePrimaryGuardian(f.guardians, id) };
    });
  }, []);

  const handleSave = useCallback(() => {
    setSaved(cloneDeep(form));
  }, [form]);

  const handleDiscard = useCallback(() => {
    setForm(cloneDeep(saved));
  }, [saved]);

  return (
    <div className="settings-page">
      <div className="analytics-shell settings-shell">
        <header className="analytics-page-head settings-page-head">
          <h1 className="analytics-title">Settings</h1>
          <p className="analytics-subtitle">
            Manage your smart nursery preferences and household access.
          </p>
        </header>

        <section className="settings-block" aria-labelledby="settings-parent1-heading">
          <SectionTitle icon={User} id="settings-parent1-heading">
            Parent 1 Details
          </SectionTitle>
          <div className="settings-card">
            <div className="settings-field-row">
              <label className="settings-field">
                <span className="settings-label">Full Name</span>
                <input
                  className="settings-input"
                  value={form.parent1.name}
                  onChange={(e) => updateParent('parent1', 'name', e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">Phone Number</span>
                <input
                  className="settings-input"
                  value={form.parent1.phone}
                  onChange={(e) => updateParent('parent1', 'phone', e.target.value)}
                  autoComplete="tel"
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">Email Address</span>
                <input
                  className="settings-input"
                  type="email"
                  value={form.parent1.email}
                  onChange={(e) => updateParent('parent1', 'email', e.target.value)}
                  autoComplete="email"
                />
              </label>
            </div>
            <div className="settings-divider" />
            <h3 className="settings-subsection-title">
              <span className="settings-section-title-ico" aria-hidden>
                <Bell size={20} strokeWidth={2} />
              </span>
              Escalation
            </h3>
            <div className="settings-toggle-row">
              <div>
                <p className="settings-toggle-label">Automatic Escalation</p>
                <p className="settings-toggle-hint">Notify guardians if parents don&apos;t respond</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.escalationEnabled}
                className={`settings-toggle ${form.escalationEnabled ? 'on' : ''}`}
                onClick={() => setForm((f) => ({ ...f, escalationEnabled: !f.escalationEnabled }))}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
            <p className="settings-chips-label">Escalate after timing:</p>
            <div className="settings-chips" role="group" aria-label="Escalation delay">
              {TIMING_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`settings-chip ${form.escalateAfter === opt ? 'selected' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, escalateAfter: opt }))}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-block" aria-labelledby="settings-parent2-heading">
          <SectionTitle icon={User} id="settings-parent2-heading">
            Parent 2 Details
          </SectionTitle>
          <div className="settings-card">
            <div className="settings-field-row">
              <label className="settings-field">
                <span className="settings-label">Full Name</span>
                <input
                  className="settings-input"
                  placeholder="Enter full name"
                  value={form.parent2.name}
                  onChange={(e) => updateParent('parent2', 'name', e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">Phone Number</span>
                <input
                  className="settings-input"
                  placeholder="+1 000 000 000"
                  value={form.parent2.phone}
                  onChange={(e) => updateParent('parent2', 'phone', e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">Email Address</span>
                <input
                  className="settings-input"
                  type="email"
                  placeholder="email@example.com"
                  value={form.parent2.email}
                  onChange={(e) => updateParent('parent2', 'email', e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="settings-block" aria-labelledby="settings-guardians-heading">
          <div className="settings-guardian-head-row">
            <h2 className="settings-section-title" id="settings-guardians-heading">
              <span className="settings-section-title-ico" aria-hidden>
                <Shield size={20} strokeWidth={2} />
              </span>
              Guardian Management
            </h2>
            <button
              type="button"
              className="settings-btn-primary"
              onClick={addGuardian}
              disabled={guardianBusy}
            >
              <Plus size={18} strokeWidth={2.5} />
              Add Guardian
            </button>
          </div>
          {guardianApiError ? (
            <p className="settings-guardian-api-error" role="alert">
              {guardianApiError}
            </p>
          ) : null}
          {form.guardians.length === 0 ? (
            <p className="settings-guardian-empty">
              No guardians listed yet. They appear here after you add them at sign-up, or you can add
              one with <strong>Add Guardian</strong>.
            </p>
          ) : (
            <div className="settings-guardian-grid">
              {form.guardians.map((g) => (
                <article key={g.id} className="settings-guardian-card">
                  <div className="settings-guardian-top">
                    <GuardianIcon type={g.icon} />
                    <div className="settings-guardian-meta">
                      <div className="settings-guardian-name-row">
                        <div className="settings-guardian-name-block">
                          {editingId === g.id ? (
                            <div className="settings-guardian-edit-fields">
                              <fieldset className="settings-guardian-rank-fieldset">
                                <legend className="settings-label">Priority</legend>
                                <div className="settings-guardian-rank-options">
                                  <label className="settings-guardian-rank-option">
                                    <input
                                      type="radio"
                                      name={`guardian-rank-${g.id}`}
                                      checked={g.rank === 'primary'}
                                      onChange={() => setGuardianRankInForm(g.id, 'primary')}
                                      disabled={guardianBusy}
                                    />
                                    <span>Primary</span>
                                  </label>
                                  <label className="settings-guardian-rank-option">
                                    <input
                                      type="radio"
                                      name={`guardian-rank-${g.id}`}
                                      checked={g.rank === 'secondary'}
                                      onChange={() => setGuardianRankInForm(g.id, 'secondary')}
                                      disabled={
                                        guardianBusy ||
                                        (g.rank === 'primary' && form.guardians.length <= 1)
                                      }
                                      title={
                                        g.rank === 'primary' && form.guardians.length <= 1
                                          ? 'Add another guardian before changing priority'
                                          : undefined
                                      }
                                    />
                                    <span>Secondary</span>
                                  </label>
                                </div>
                                {g.rank === 'primary' && form.guardians.length <= 1 ? (
                                  <p className="settings-guardian-rank-hint">
                                    Add another guardian to change priority.
                                  </p>
                                ) : (
                                  <p className="settings-guardian-rank-hint">
                                    Primary appears first in the list. Save to sync to your account.
                                  </p>
                                )}
                              </fieldset>
                              <label className="settings-field settings-field--full">
                                <span className="settings-label">Name</span>
                                <input
                                  className="settings-input"
                                  value={g.name}
                                  onChange={(e) => updateGuardianField(g.id, 'name', e.target.value)}
                                  autoComplete="name"
                                  disabled={guardianBusy}
                                />
                              </label>
                              <label className="settings-field settings-field--full">
                                <span className="settings-label">Relationship</span>
                                <input
                                  className="settings-input"
                                  value={g.role}
                                  onChange={(e) => updateGuardianField(g.id, 'role', e.target.value)}
                                  placeholder="e.g. Grand Mother"
                                  disabled={guardianBusy}
                                />
                              </label>
                              <label className="settings-field settings-field--full">
                                <span className="settings-label">Phone</span>
                                <input
                                  className="settings-input"
                                  value={g.phone}
                                  onChange={(e) => updateGuardianField(g.id, 'phone', e.target.value)}
                                  autoComplete="tel"
                                  disabled={guardianBusy}
                                />
                              </label>
                            </div>
                          ) : (
                            <>
                              <p className="settings-guardian-name">{g.name || '-'}</p>
                              <p className="settings-guardian-role">{g.role || 'Guardian'}</p>
                            </>
                          )}
                        </div>
                        <div className="settings-guardian-badges">
                          {g.rank === 'primary' ? (
                            <span className="settings-badge settings-badge--primary">
                              <Star size={11} strokeWidth={2.5} fill="currentColor" />
                              PRIMARY
                            </span>
                          ) : (
                            <span className="settings-badge settings-badge--secondary">
                              <SquarePen size={11} strokeWidth={2.5} />
                              SECONDARY
                            </span>
                          )}
                          {g.online ? (
                            <span className="settings-badge settings-badge--online">
                              <span className="settings-dot settings-dot--on" />
                              ONLINE
                            </span>
                          ) : (
                            <span className="settings-badge settings-badge--offline">
                              <span className="settings-dot" />
                              OFFLINE
                            </span>
                          )}
                        </div>
                      </div>
                      {editingId !== g.id ? (
                        <p className="settings-guardian-phone">
                          <Phone size={14} strokeWidth={2} aria-hidden />
                          {g.phone || '-'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="settings-guardian-actions">
                    {editingId === g.id ? (
                      <>
                        <button
                          type="button"
                          className="settings-guardian-btn settings-guardian-btn--edit"
                          onClick={saveGuardianEdit}
                          disabled={guardianBusy}
                        >
                          {guardianBusy ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="settings-guardian-btn settings-guardian-btn--remove"
                          onClick={cancelGuardianEdit}
                          disabled={guardianBusy}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="settings-guardian-btn settings-guardian-btn--edit"
                          onClick={() => setEditingId(g.id)}
                          disabled={guardianBusy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="settings-guardian-btn settings-guardian-btn--remove"
                          onClick={() => removeGuardian(g.id)}
                          disabled={guardianBusy}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="settings-block" aria-labelledby="settings-prefs-heading">
          <SectionTitle icon={SlidersHorizontal} id="settings-prefs-heading">
            App Preferences
          </SectionTitle>
          <div className="settings-card settings-prefs-card">
            <label className="settings-field settings-field--full">
              <span className="settings-label">Language</span>
              <div className="settings-select-wrap">
                <select
                  className="settings-select"
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es">Spanish</option>
                </select>
                <ChevronDown className="settings-select-chevron" size={18} aria-hidden />
              </div>
            </label>
            <label className="settings-field settings-field--full">
              <span className="settings-label">Alert Sound</span>
              <div className="settings-select-wrap">
                <select
                  className="settings-select"
                  value={form.alertSound}
                  onChange={(e) => setForm((f) => ({ ...f, alertSound: e.target.value }))}
                >
                  <option value="gentle">Gentle Chime</option>
                  <option value="classic">Classic Bell</option>
                  <option value="soft">Soft Pulse</option>
                </select>
                <ChevronDown className="settings-select-chevron" size={18} aria-hidden />
              </div>
            </label>
            <div className="settings-toggle-row settings-prefs-dark">
              <div className="settings-prefs-dark-label">
                <Moon size={18} strokeWidth={2} className="settings-moon-ico" aria-hidden />
                <span>Dark Mode</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.darkMode}
                className={`settings-toggle ${form.darkMode ? 'on' : ''}`}
                onClick={() => setForm((f) => ({ ...f, darkMode: !f.darkMode }))}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
            <div className="settings-prefs-footer">
              <button
                type="button"
                className="settings-btn-text"
                onClick={handleDiscard}
                disabled={!dirty}
              >
                Discard Changes
              </button>
              <button type="button" className="settings-btn-primary" onClick={handleSave} disabled={!dirty}>
                Save All Settings
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
