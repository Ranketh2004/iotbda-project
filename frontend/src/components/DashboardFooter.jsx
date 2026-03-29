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
        <nav className="dash-footer-links" aria-label="Footer">
          <a href="#privacy">Privacy Policy</a>
          <a href="#support">Support</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
