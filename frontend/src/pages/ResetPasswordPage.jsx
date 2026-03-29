import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const BRAND = 'Infant Cry Guard';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          password_confirm: passwordConfirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Something went wrong.');
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
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
          <h2 className="login-quote-title">Almost there!</h2>
          <p className="login-quote-text">
            Choose a new password to secure your account.
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

          <h1 className="login-heading">Reset Password</h1>
          <p className="login-sub">Enter your new password below.</p>

          {success ? (
            <div className="login-form" style={{ textAlign: 'center' }}>
              <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: 12 }}>
                ✓ Password reset successfully!
              </p>
              <p className="login-sub">Redirecting to login…</p>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <p className="login-form-error" role="alert">
                  {error}
                </p>
              )}

              {!token && (
                <p className="login-form-error" role="alert">
                  Missing reset token. Please use the link from your email.
                </p>
              )}

              <div className="login-field">
                <label className="login-label" htmlFor="reset-password">
                  New Password
                </label>
                <div className="login-password-wrap">
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password"
                    className="login-input login-input-password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    disabled={loading || !token}
                    required
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

              <label className="login-field">
                <span className="login-label">Confirm Password</span>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="login-input"
                  value={passwordConfirm}
                  onChange={(ev) => setPasswordConfirm(ev.target.value)}
                  disabled={loading || !token}
                  required
                />
              </label>

              <button type="submit" className="login-submit" disabled={loading || !token}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="login-footer-text" style={{ marginTop: 24 }}>
            <Link to="/login" className="login-signup">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
