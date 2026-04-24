import React from 'react';

const BRAND = 'Infant Cry Guard';

export default function DashboardFooter() {
  return (
    <footer className="dash-footer">
      <div className="dash-footer-inner">
        <div className="dash-footer-brand">
          <span className="dash-footer-logo" aria-hidden>
            <span className="dash-footer-face">◡</span>
          </span>
          <span className="dash-footer-copyline">
            © {new Date().getFullYear()} {BRAND}. All rights reserved.
          </span>
        </div>
        <div className="dash-footer-links">
          <span className="dash-footer-muted">Privacy</span>
          <span className="dash-footer-sep" aria-hidden>
            ·
          </span>
          <span className="dash-footer-muted">Support</span>
          <span className="dash-footer-sep" aria-hidden>
            ·
          </span>
          <span className="dash-footer-muted">Contact</span>
        </div>
      </div>
    </footer>
  );
}
