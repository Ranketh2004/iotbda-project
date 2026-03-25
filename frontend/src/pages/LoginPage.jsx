import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const BRAND = 'Infant Cry Guard';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
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

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /** Browsers autofill readonly fields less reliably; removed on focus so the user can type. */
  const [emailReadOnly, setEmailReadOnly] = useState(true);
  const [passwordReadOnly, setPasswordReadOnly] = useState(true);

  useEffect(() => {
    if (location.pathname !== '/login') return;
    setEmail('');
    setPassword('');
    setError('');
    setEmailReadOnly(true);
    setPasswordReadOnly(true);
  }, [location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
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
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-image-wrap">
          <img
            src="/images/login-nursery.webp"
            alt="Cozy nursery with crib and toys"
            className="login-left-img"
          />
        </div>
        <div className="login-left-quote">
          <h2 className="login-quote-title">Peace of mind for every parent</h2>
          <p className="login-quote-text">
            Advanced AI sound detection that learns your baby&apos;s unique cries to keep them safe and
            happy.
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-inner">
          <Link to="/" className="login-brand">
            <span className="login-brand-icon" aria-hidden>
              <span className="login-brand-face">◡</span>
            </span>
            <span className="login-brand-name">{BRAND}</span>
          </Link>

          <h1 className="login-heading">Welcome Back</h1>
          <p className="login-sub">Log in to monitor your baby&apos;s safety in real time</p>

          <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
            {/*
              Decoy fields: many password managers fill the first username/password pair in the form.
            */}
            <div className="login-autofill-trap" aria-hidden="true">
              <input type="text" tabIndex={-1} autoComplete="username" readOnly />
              <input type="password" tabIndex={-1} autoComplete="current-password" readOnly />
            </div>
            {error ? (
              <p className="login-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <label className="login-field">
              <span className="login-label">Email or Phone Number</span>
              <input
                type="text"
                name="cryguard_login_identifier"
                id="cryguard-login-identifier"
                autoComplete="off"
                placeholder="Email or phone number"
                className="login-input"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                readOnly={emailReadOnly && !loading}
                onFocus={() => setEmailReadOnly(false)}
                disabled={loading}
              />
            </label>

            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label" htmlFor="cryguard-login-password">
                  Password
                </label>
                <Link to="/forgot-password" className="login-forgot">
                  Forgot password?
                </Link>
              </div>
              <div className="login-password-wrap">
                <input
                  id="cryguard-login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="cryguard_login_secret"
                  autoComplete="new-password"
                  placeholder="Password"
                  className="login-input login-input-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  readOnly={passwordReadOnly && !loading}
                  onFocus={() => setPasswordReadOnly(false)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="login-divider">
            <span>or continue with</span>
          </div>

          <div className="login-social">
            <button
              type="button"
              className="login-social-btn"
              aria-label="Continue with Google"
              onClick={() => {
                window.location.href = '/api/auth/google/login';
              }}
            >
              <GoogleIcon />
              Google
            </button>
            <button type="button" className="login-social-btn" aria-label="Continue with Apple">
              <AppleIcon />
              Apple
            </button>
          </div>

          <p className="login-footer-text">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="login-signup">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
