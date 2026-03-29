import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const BRAND = 'Infant Cry Guard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Something went wrong.');
        return;
      }
      setSent(true);
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
          <h2 className="login-quote-title">Don&apos;t worry</h2>
          <p className="login-quote-text">
            We&apos;ll help you get back into your account in no time.
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

          <h1 className="login-heading">Forgot Password</h1>
          <p className="login-sub">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="login-form" style={{ textAlign: 'center' }}>
              <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: 12 }}>
                ✓ Reset link sent!
              </p>
              <p className="login-sub">
                Check your email inbox (and spam folder) for the reset link.
              </p>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <p className="login-form-error" role="alert">
                  {error}
                </p>
              )}
              <label className="login-field">
                <span className="login-label">Email Address</span>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="login-input"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="login-footer-text" style={{ marginTop: 24 }}>
            Remember your password?{' '}
            <Link to="/login" className="login-signup">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
