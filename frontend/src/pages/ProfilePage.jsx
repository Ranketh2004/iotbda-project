import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Baby,
  Camera,
  ShieldCheck,
  Lock,
  LogOut,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import DashboardFooter from '../components/DashboardFooter';
import { DEFAULT_BABY_PLACEHOLDER_SRC } from '../constants/assets';
import { BABY_AGE_OPTIONS, mapApiUserToProfileForm } from '../constants/userProfile';

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatApiError(data) {
  if (!data || typeof data !== 'object') return 'Something went wrong.';
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => (typeof d.msg === 'string' ? d.msg : JSON.stringify(d)))
      .join(' ');
  }
  return 'Something went wrong.';
}

function SectionTitle({ icon: Icon, children, id }) {
  return (
    <h2 className="settings-section-title profile-section-title" id={id}>
      <span className="settings-section-title-ico" aria-hidden>
        <Icon size={20} strokeWidth={2} />
      </span>
      {children}
    </h2>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => mapApiUserToProfileForm(null));
  const [saved, setSaved] = useState(() => mapApiUserToProfileForm(null));
  const [parentPreview, setParentPreview] = useState(null);
  const [babyPreview, setBabyPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const parentPhotoRef = useRef(null);
  const babyPhotoRef = useRef(null);
  const pendingParentFile = useRef(null);
  const pendingBabyFile = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    (async () => {
      const token = localStorage.getItem('cryguard_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          if (res.ok) {
            const u = await res.json();
            localStorage.setItem('cryguard_user', JSON.stringify(u));
            const next = mapApiUserToProfileForm(u);
            setForm(next);
            setSaved(cloneDeep(next));
            return;
          }
        } catch {
          if (!cancelled) setLoadError('Could not load profile from server.');
        }
      }
      const raw = localStorage.getItem('cryguard_user');
      if (raw && !cancelled) {
        try {
          const u = JSON.parse(raw);
          const next = mapApiUserToProfileForm(u);
          setForm(next);
          setSaved(cloneDeep(next));
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (parentPreview) URL.revokeObjectURL(parentPreview);
      if (babyPreview) URL.revokeObjectURL(babyPreview);
    };
  }, [parentPreview, babyPreview]);

  const dirty = useMemo(() => {
    if (pendingParentFile.current || pendingBabyFile.current) return true;
    return JSON.stringify(form) !== JSON.stringify(saved);
  }, [form, saved, parentPreview, babyPreview]);

  const revokePreviews = useCallback(() => {
    if (parentPreview) URL.revokeObjectURL(parentPreview);
    if (babyPreview) URL.revokeObjectURL(babyPreview);
    setParentPreview(null);
    setBabyPreview(null);
  }, [parentPreview, babyPreview]);

  const handleSave = useCallback(async () => {
    setSaveError('');
    const token = localStorage.getItem('cryguard_token');
    if (!token) {
      setSaveError('You need to be logged in to save.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('phone', form.accountPhone);
      fd.append('motherName', form.motherName);
      fd.append('motherPhone', form.motherPhone);
      fd.append('motherEmail', form.motherEmail);
      fd.append('fatherName', form.fatherName);
      fd.append('fatherPhone', form.fatherPhone);
      fd.append('fatherEmail', form.fatherEmail);
      fd.append('babyName', form.babyName);
      fd.append('babyAge', form.babyAge);
      fd.append('babyGender', form.babyGender);
      if (pendingParentFile.current) fd.append('parentPhoto', pendingParentFile.current);
      if (pendingBabyFile.current) fd.append('babyPhoto', pendingBabyFile.current);

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(formatApiError(data));
        return;
      }
      localStorage.setItem('cryguard_user', JSON.stringify(data));
      const next = mapApiUserToProfileForm(data);
      revokePreviews();
      pendingParentFile.current = null;
      pendingBabyFile.current = null;
      if (parentPhotoRef.current) parentPhotoRef.current.value = '';
      if (babyPhotoRef.current) babyPhotoRef.current.value = '';
      setForm(next);
      setSaved(cloneDeep(next));
    } catch {
      setSaveError('Network error. Is the API running?');
    } finally {
      setSaving(false);
    }
  }, [form, revokePreviews]);

  const handleCancel = useCallback(() => {
    setForm(cloneDeep(saved));
    revokePreviews();
    pendingParentFile.current = null;
    pendingBabyFile.current = null;
    if (parentPhotoRef.current) parentPhotoRef.current.value = '';
    if (babyPhotoRef.current) babyPhotoRef.current.value = '';
  }, [saved, revokePreviews]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('cryguard_token');
    localStorage.removeItem('cryguard_user');
    navigate('/login', { replace: true });
  }, [navigate]);

  const parentAvatarSrc = parentPreview || form.parentPhotoUrl || null;
  const babyAvatarSrc = babyPreview || form.babyPhotoUrl || null;

  return (
    <div className="dash-page settings-page">
      <DashboardHeader />
      <div className="analytics-shell profile-shell">
        <header className="analytics-page-head settings-page-head">
          <h1 className="analytics-title">Profile Settings</h1>
          <p className="analytics-subtitle">
            Update your information and your baby&apos;s profile details.
          </p>
        </header>

        {loadError ? (
          <p className="signup-form-error profile-load-error" role="alert">
            {loadError}
          </p>
        ) : null}
        {saveError ? (
          <p className="signup-form-error profile-load-error" role="alert">
            {saveError}
          </p>
        ) : null}

        <section className="settings-block" aria-labelledby="profile-parent-heading">
          <SectionTitle icon={User} id="profile-parent-heading">
            Parents &amp; account
          </SectionTitle>
          <div className="settings-card profile-card">
            <div className="profile-card-layout profile-card-layout--parents">
              <div className="profile-photo-block">
                <input
                  ref={parentPhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="profile-file-input"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (parentPreview) URL.revokeObjectURL(parentPreview);
                    pendingParentFile.current = f;
                    setParentPreview(URL.createObjectURL(f));
                  }}
                />
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar profile-avatar--parent" aria-hidden>
                    {parentAvatarSrc ? (
                      <img src={parentAvatarSrc} alt="" className="profile-avatar-img" />
                    ) : (
                      <Camera size={52} strokeWidth={1.6} className="profile-avatar-placeholder-ico profile-avatar-placeholder-ico--parent" />
                    )}
                  </div>
                  <button
                    type="button"
                    className="profile-photo-fab"
                    aria-label="Change parent photo"
                    onClick={() => parentPhotoRef.current?.click()}
                  >
                    <Camera size={15} strokeWidth={2.2} />
                  </button>
                </div>
                <span className="profile-photo-caption">Parent photo</span>
              </div>
              <div className="profile-fields-stack profile-fields-stack--parents">
                <p className="profile-inline-section-title">Account login</p>
                <label className="settings-field">
                  <span className="settings-label">Login email</span>
                  <input
                    className="settings-input"
                    type="email"
                    value={form.accountEmail}
                    readOnly
                    aria-readonly="true"
                    title="Login email cannot be changed here"
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Account phone</span>
                  <input
                    className="settings-input"
                    value={form.accountPhone}
                    onChange={(e) => setForm((f) => ({ ...f, accountPhone: e.target.value }))}
                    autoComplete="tel"
                  />
                </label>
                <p className="profile-inline-section-title">Mother</p>
                <label className="settings-field">
                  <span className="settings-label">Full name</span>
                  <input
                    className="settings-input"
                    value={form.motherName}
                    onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))}
                    autoComplete="name"
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Phone</span>
                  <input
                    className="settings-input"
                    value={form.motherPhone}
                    onChange={(e) => setForm((f) => ({ ...f, motherPhone: e.target.value }))}
                    autoComplete="tel"
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Email</span>
                  <input
                    className="settings-input"
                    type="email"
                    value={form.motherEmail}
                    onChange={(e) => setForm((f) => ({ ...f, motherEmail: e.target.value }))}
                    autoComplete="email"
                  />
                </label>
                <p className="profile-inline-section-title">Father</p>
                <label className="settings-field">
                  <span className="settings-label">Full name</span>
                  <input
                    className="settings-input"
                    value={form.fatherName}
                    onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
                    autoComplete="name"
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Phone</span>
                  <input
                    className="settings-input"
                    value={form.fatherPhone}
                    onChange={(e) => setForm((f) => ({ ...f, fatherPhone: e.target.value }))}
                    autoComplete="tel"
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Email</span>
                  <input
                    className="settings-input"
                    type="email"
                    value={form.fatherEmail}
                    onChange={(e) => setForm((f) => ({ ...f, fatherEmail: e.target.value }))}
                    autoComplete="email"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-block" aria-labelledby="profile-baby-heading">
          <SectionTitle icon={Baby} id="profile-baby-heading">
            Baby Profile
          </SectionTitle>
          <div className="settings-card profile-card">
            <div className="profile-card-layout">
              <div className="profile-photo-block">
                <input
                  ref={babyPhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="profile-file-input"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (babyPreview) URL.revokeObjectURL(babyPreview);
                    pendingBabyFile.current = f;
                    setBabyPreview(URL.createObjectURL(f));
                  }}
                />
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar profile-avatar--baby">
                    {babyAvatarSrc ? (
                      <img src={babyAvatarSrc} alt="" className="profile-avatar-img" />
                    ) : (
                      <img
                        src={DEFAULT_BABY_PLACEHOLDER_SRC}
                        alt=""
                        className="profile-avatar-img profile-avatar-img--baby-placeholder"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="profile-photo-fab"
                    aria-label="Change baby photo"
                    onClick={() => babyPhotoRef.current?.click()}
                  >
                    <Camera size={15} strokeWidth={2.2} />
                  </button>
                </div>
                <span className="profile-photo-caption">Baby photo</span>
              </div>
              <div className="profile-fields-stack profile-fields-stack--baby">
                <label className="settings-field">
                  <span className="settings-label">Baby&apos;s Name</span>
                  <input
                    className="settings-input"
                    value={form.babyName}
                    onChange={(e) => setForm((f) => ({ ...f, babyName: e.target.value }))}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Age (in months)</span>
                  <div className="settings-select-wrap">
                    <select
                      className="settings-select"
                      value={form.babyAge}
                      onChange={(e) => setForm((f) => ({ ...f, babyAge: e.target.value }))}
                    >
                      {BABY_AGE_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="settings-select-chevron" size={18} aria-hidden />
                  </div>
                </label>
                <label className="settings-field">
                  <span className="settings-label">Gender</span>
                  <div className="settings-select-wrap">
                    <select
                      className="settings-select"
                      value={form.babyGender}
                      onChange={(e) => setForm((f) => ({ ...f, babyGender: e.target.value }))}
                    >
                      <option value="boy">Boy</option>
                      <option value="girl">Girl</option>
                      <option value="other">Prefer not to say</option>
                    </select>
                    <ChevronDown className="settings-select-chevron" size={18} aria-hidden />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-block" aria-labelledby="profile-security-heading">
          <div className="settings-card profile-security-card" id="profile-security-heading">
            <h2 className="profile-security-heading">
              <span className="settings-section-title-ico" aria-hidden>
                <ShieldCheck size={20} strokeWidth={2} />
              </span>
              Account Security
            </h2>
            <div className="profile-security-row">
              <div className="profile-security-row-inner">
                <span className="profile-security-ico" aria-hidden>
                  <Lock size={18} strokeWidth={2} />
                </span>
                <div className="profile-security-text">
                  <p className="profile-security-title">Password</p>
                  <p className="profile-security-sub">Last changed 3 months ago</p>
                </div>
                <button type="button" className="profile-btn-soft">
                  Change Password
                </button>
              </div>
            </div>
            <div className="profile-security-row">
              <div className="profile-security-row-inner">
                <span className="profile-security-ico" aria-hidden>
                  <Smartphone size={18} strokeWidth={2} />
                </span>
                <div className="profile-security-text">
                  <p className="profile-security-title">Two-Factor Authentication</p>
                  <p className="profile-security-sub">Add an extra layer of security</p>
                </div>
                <button type="button" className="profile-btn-primary-solid">
                  Enable
                </button>
              </div>
            </div>
            <div className="profile-security-row profile-security-row--logout">
              <div className="profile-security-row-inner">
                <span className="profile-security-ico" aria-hidden>
                  <LogOut size={18} strokeWidth={2} />
                </span>
                <div className="profile-security-text">
                  <p className="profile-security-title">Log out</p>
                  <p className="profile-security-sub">Sign out on this device</p>
                </div>
                <button type="button" className="profile-btn-logout" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-page-footer">
          <button type="button" className="profile-btn-cancel" onClick={handleCancel} disabled={!dirty}>
            Cancel
          </button>
          <button
            type="button"
            className="profile-btn-save"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
      <DashboardFooter />
    </div>
  );
}
