import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Baby,
  Radio,
  BarChart3,
  Bell,
  Shield,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import BrandLogoMark from '../components/BrandLogoMark';
import { BABY_AGE_OPTIONS } from '../constants/userProfile';

const BRAND = 'Infant Cry Guard';

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

export default function SignupPage() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /** Who is creating the login: we collect the other parent's details only. */
  const [registrantRole, setRegistrantRole] = useState('mother');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) return;
    setError('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = (fd.get('password') ?? '').toString();
    const passwordConfirm = (fd.get('passwordConfirm') ?? '').toString();
    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    const loginEmail = (fd.get('email') ?? '').toString().trim();
    const accountPhone = (fd.get('phone') ?? '').toString();
    const registrantName = (fd.get('registrantFullName') ?? '').toString().trim();
    if (!registrantName) {
      setError('Please enter your full name.');
      return;
    }

    fd.delete('registrantFullName');

    if (registrantRole === 'mother') {
      fd.set('motherName', registrantName);
      fd.set('motherPhone', accountPhone);
      fd.set('motherEmail', loginEmail);
    } else {
      fd.set('fatherName', registrantName);
      fd.set('fatherPhone', accountPhone);
      fd.set('fatherEmail', loginEmail);
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiError(data));
        return;
      }
      if (data.access_token) {
        localStorage.setItem('cryguard_token', data.access_token);
      }
      if (data.user) {
        localStorage.setItem('cryguard_user', JSON.stringify(data.user));
      }
      navigate('/dashboard');
    } catch {
      setError('Network error. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <header className="signup-header">
        <div className="signup-header-inner">
          <Link to="/" className="signup-logo">
            <span className="signup-logo-icon" aria-hidden>
              <span className="signup-logo-face">◡</span>
            </span>
            <span className="signup-logo-name">{BRAND}</span>
          </Link>
          <Link to="/login" className="signup-header-login">
            Log In
          </Link>
        </div>
      </header>

      <div className="signup-hero">
        <h1 className="signup-hero-title">Protect what matters most</h1>
        <p className="signup-hero-sub">
          Create your account to start monitoring your baby with AI-powered cry detection and
          immediate guardian alerts.
        </p>
      </div>

      <div className="signup-layout">
        <div className="signup-main">
          <form className="signup-form" onSubmit={handleSubmit} noValidate>
            {error ? (
              <p className="signup-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <section className="signup-card">
              <h2 className="signup-card-title">
                <span className="signup-card-icon signup-card-icon--blue">
                  <User size={18} strokeWidth={2} />
                </span>
                1. Account &amp; parent details
              </h2>
              <div className="signup-fields">
                <h3 className="signup-subsection-title">Account login</h3>
                <p className="signup-subsection-hint">
                  Choose whether you are the mother or father signing up. Your login email and phone
                  are saved with your parent profile; you will only add the other parent&apos;s details
                  below.
                </p>
                <div className="signup-field signup-field--full" role="group" aria-label="Registering as">
                  <span className="signup-field-label">I am registering as</span>
                  <div className="signup-radio-row">
                    <label className="signup-radio-label">
                      <input
                        type="radio"
                        className="signup-radio-input"
                        checked={registrantRole === 'mother'}
                        onChange={() => setRegistrantRole('mother')}
                      />
                      <span>Mother</span>
                    </label>
                    <label className="signup-radio-label">
                      <input
                        type="radio"
                        className="signup-radio-input"
                        checked={registrantRole === 'father'}
                        onChange={() => setRegistrantRole('father')}
                      />
                      <span>Father</span>
                    </label>
                  </div>
                </div>
                <label className="signup-field signup-field--full">
                  <span className="signup-field-label">Your full name</span>
                  <input
                    type="text"
                    name="registrantFullName"
                    placeholder="Your full name"
                    className="signup-input"
                    autoComplete="name"
                  />
                </label>
                <label className="signup-field">
                  <span className="signup-field-label">Email Address (login)</span>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    className="signup-input"
                    autoComplete="email"
                  />
                </label>
                <label className="signup-field">
                  <span className="signup-field-label">Your phone (optional)</span>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+1 (555) 000-0000"
                    className="signup-input"
                    autoComplete="tel"
                  />
                </label>
                <label className="signup-field">
                  <span className="signup-field-label">Password</span>
                  <div className="signup-input-wrap">
                    <input
                      type={showPw ? 'text' : 'password'}
                      name="password"
                      placeholder="••••••••"
                      className="signup-input signup-input--pw"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="signup-pw-toggle"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <label className="signup-field">
                  <span className="signup-field-label">Confirm Password</span>
                  <div className="signup-input-wrap">
                    <input
                      type={showPw2 ? 'text' : 'password'}
                      name="passwordConfirm"
                      placeholder="••••••••"
                      className="signup-input signup-input--pw"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="signup-pw-toggle"
                      onClick={() => setShowPw2((v) => !v)}
                      aria-label={showPw2 ? 'Hide password' : 'Show password'}
                    >
                      {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <label className="signup-field signup-field--full">
                  <span className="signup-field-label">Your photo (optional)</span>
                  <input
                    type="file"
                    name="parentPhoto"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="signup-file-input"
                  />
                  <span className="signup-file-hint">JPEG, PNG, WebP, or GIF · max 5MB</span>
                </label>

                {registrantRole === 'mother' ? (
                  <div key="father-fields" className="signup-other-parent-block">
                    <h3 className="signup-subsection-title">Father&apos;s details</h3>
                    <p className="signup-subsection-hint">
                      Add the father&apos;s contact information (optional fields can be left blank).
                    </p>
                    <label className="signup-field signup-field--full">
                      <span className="signup-field-label">Full name</span>
                      <input type="text" name="fatherName" placeholder="Full name" className="signup-input" />
                    </label>
                    <label className="signup-field">
                      <span className="signup-field-label">Phone</span>
                      <input
                        type="tel"
                        name="fatherPhone"
                        placeholder="+1 (555) 000-0000"
                        className="signup-input"
                      />
                    </label>
                    <label className="signup-field">
                      <span className="signup-field-label">Email (optional)</span>
                      <input
                        type="email"
                        name="fatherEmail"
                        placeholder="father@example.com"
                        className="signup-input"
                      />
                    </label>
                  </div>
                ) : (
                  <div key="mother-fields" className="signup-other-parent-block">
                    <h3 className="signup-subsection-title">Mother&apos;s details</h3>
                    <p className="signup-subsection-hint">
                      Add the mother&apos;s contact information (optional fields can be left blank).
                    </p>
                    <label className="signup-field signup-field--full">
                      <span className="signup-field-label">Full name</span>
                      <input type="text" name="motherName" placeholder="Full name" className="signup-input" />
                    </label>
                    <label className="signup-field">
                      <span className="signup-field-label">Phone</span>
                      <input
                        type="tel"
                        name="motherPhone"
                        placeholder="+1 (555) 000-0000"
                        className="signup-input"
                      />
                    </label>
                    <label className="signup-field">
                      <span className="signup-field-label">Email (optional)</span>
                      <input
                        type="email"
                        name="motherEmail"
                        placeholder="mother@example.com"
                        className="signup-input"
                      />
                    </label>
                  </div>
                )}
              </div>
            </section>

            <section className="signup-card">
              <h2 className="signup-card-title">
                <span className="signup-card-icon signup-card-icon--teal">
                  <Baby size={18} strokeWidth={2} />
                </span>
                2. Baby profile setup
              </h2>
              <div className="signup-fields signup-fields--baby">
                <label className="signup-field signup-field--full">
                  <span className="signup-field-label">Baby&apos;s Name</span>
                  <input
                    type="text"
                    name="babyName"
                    placeholder="Enter baby&apos;s name"
                    className="signup-input"
                  />
                </label>
                <label className="signup-field signup-field--full">
                  <span className="signup-field-label">Age (In Months)</span>
                  <div className="signup-select-wrap">
                    <select name="babyAge" className="signup-select" defaultValue="0-3">
                      {BABY_AGE_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="signup-select-chevron" aria-hidden />
                  </div>
                </label>
                <label className="signup-field signup-field--full">
                  <span className="signup-field-label">Baby&apos;s gender</span>
                  <div className="signup-select-wrap">
                    <select name="babyGender" className="signup-select" defaultValue="boy">
                      <option value="boy">Boy</option>
                      <option value="girl">Girl</option>
                      <option value="other">Prefer not to say</option>
                    </select>
                    <ChevronDown size={18} className="signup-select-chevron" aria-hidden />
                  </div>
                </label>
                <label className="signup-field signup-field--full">
                  <span className="signup-field-label">Baby&apos;s photo (optional)</span>
                  <input
                    type="file"
                    name="babyPhoto"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="signup-file-input"
                  />
                  <span className="signup-file-hint">JPEG, PNG, WebP, or GIF · max 5MB</span>
                </label>
              </div>
            </section>

            <section className="signup-card">
              <h2 className="signup-card-title">
                <span className="signup-card-icon signup-card-icon--orange">
                  <Radio size={18} strokeWidth={2} />
                </span>
                3. Guardian alert contacts
              </h2>
              <p className="signup-card-desc">
                If parents do not respond to urgent baby alerts, notifications will automatically be
                sent to guardians in priority order.
              </p>

              <div className="signup-guardian">
                <p className="signup-guardian-label">Primary Guardian (Priority 1)</p>
                <div className="signup-guardian-fields">
                  <label className="signup-field">
                    <span className="signup-field-label">Full Name</span>
                    <input type="text" name="g1name" className="signup-input" />
                  </label>
                  <label className="signup-field">
                    <span className="signup-field-label">Relationship</span>
                    <input
                      type="text"
                      name="g1rel"
                      placeholder="Grandparent, Aunt, etc."
                      className="signup-input"
                    />
                  </label>
                  <label className="signup-field">
                    <span className="signup-field-label">Phone Number</span>
                    <input type="tel" name="g1phone" className="signup-input" />
                  </label>
                </div>
              </div>

              <div className="signup-guardian">
                <p className="signup-guardian-label">Secondary Guardian (Priority 2)</p>
                <div className="signup-guardian-fields">
                  <label className="signup-field">
                    <span className="signup-field-label">Full Name</span>
                    <input type="text" name="g2name" className="signup-input" />
                  </label>
                  <label className="signup-field">
                    <span className="signup-field-label">Relationship</span>
                    <input
                      type="text"
                      name="g2rel"
                      placeholder="Grandparent, Aunt, etc."
                      className="signup-input"
                    />
                  </label>
                  <label className="signup-field">
                    <span className="signup-field-label">Phone Number</span>
                    <input type="tel" name="g2phone" className="signup-input" />
                  </label>
                </div>
              </div>
            </section>

            <label className="signup-terms">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="signup-checkbox"
              />
              <span>
                I agree to the{' '}
                <a href="#terms" className="signup-inline-link">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="signup-inline-link">
                  Privacy Policy
                </a>
                . I understand that Infant Cry Guard is a monitoring aid and not a medical device.
              </span>
            </label>

            <button type="submit" className="signup-submit" disabled={!agreed || loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <p className="signup-switch">
              Already have an account?{' '}
              <Link to="/login" className="signup-inline-link">
                Sign In
              </Link>
            </p>
          </form>
        </div>

        <aside className="signup-aside">
          <div className="signup-why">
            <h3 className="signup-why-title">Why Infant Cry Guard?</h3>
            <ul className="signup-why-list">
              <li>
                <span className="signup-why-ico">
                  <BarChart3 size={20} strokeWidth={2} />
                </span>
                <div>
                  <strong>AI Cry Analysis</strong>
                  <p>Identify hunger, fatigue, or discomfort cries instantly.</p>
                </div>
              </li>
              <li>
                <span className="signup-why-ico">
                  <Bell size={20} strokeWidth={2} />
                </span>
                <div>
                  <strong>Fail-safe Alerts</strong>
                  <p>Multi-tier guardian notifications ensure someone is always notified.</p>
                </div>
              </li>
              <li>
                <span className="signup-why-ico">
                  <Shield size={20} strokeWidth={2} />
                </span>
                <div>
                  <strong>Secure Streaming</strong>
                  <p>End-to-end encryption for your baby&apos;s privacy and safety.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="signup-aside-visual">
            <img
              src="/images/hero-baby.jpg"
              alt=""
              className="signup-aside-img"
            />
            <p className="signup-aside-caption">Peace of mind for the whole family, day and night.</p>
          </div>
        </aside>
      </div>

      <footer className="signup-footer">
        <div className="signup-footer-inner">
          <div className="signup-footer-brand">
            <span className="signup-logo-icon signup-logo-icon--sm" aria-hidden>
              <BrandLogoMark compact />
            </span>
            <span className="signup-footer-name">{BRAND}</span>
          </div>
          <p className="signup-footer-copy">
            © {new Date().getFullYear()} Infant Cry Guard. All rights reserved.
          </p>
          <nav className="signup-footer-links" aria-label="Footer">
            <a href="#support">Support</a>
            <a href="#privacy">Privacy</a>
            <a href="#cookies">Cookies</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
