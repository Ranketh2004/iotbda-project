import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Video, Brain, Bell, Award, Share2, Camera } from 'lucide-react';
import BrandLogoMark from '../components/BrandLogoMark';

const BRAND = 'Infant Cry Guard';

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-icon" aria-hidden>
              <BrandLogoMark />
            </span>
            <span className="landing-logo-text">
              <span className="landing-logo-title">{BRAND}</span>
              <span className="landing-logo-sub">SMART MONITORING</span>
            </span>
          </Link>

          <div className="landing-header-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost">
              Log In
            </Link>
            <Link to="/signup" className="landing-btn landing-btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <div className="landing-trust-badge">
                <Shield size={14} strokeWidth={2.5} />
                TRUSTED BY 50K+ PARENTS
              </div>
              <h1 className="landing-headline">
                Peace of mind, <span className="landing-headline-accent">one sleep</span> at a time.
              </h1>
              <p className="landing-subhead">
                Smart baby monitoring designed for safer, calmer parenting. Our AI understands your
                baby&apos;s needs before you even walk in the room.
              </p>
              <div className="landing-cta-row">
                <Link to="/signup" className="landing-btn landing-btn-hero">
                  Start Free Trial
                </Link>
                <a href="#demo" className="landing-btn landing-btn-outline-lg">
                  Watch Demo
                </a>
              </div>
              <div className="landing-social-proof">
                <div className="landing-avatars" aria-hidden>
                  <img src="https://i.pravatar.cc/80?img=32" alt="" />
                  <img src="https://i.pravatar.cc/80?img=45" alt="" />
                  <img src="https://i.pravatar.cc/80?img=12" alt="" />
                </div>
                <p>Join 2,000+ new parents this week</p>
              </div>
            </div>

            <div className="landing-hero-visual">
              <div className="landing-hero-image-wrap">
                <img
                  src="/images/hero-baby.jpg"
                  alt="Baby sleeping peacefully in a crib"
                  className="landing-hero-image"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-inner">
            <h2 className="landing-section-title">The smarter way to monitor</h2>
            <p className="landing-section-sub">
              Advanced technology wrapped in simplicity, giving you the tools to be the best parent
              you can be.
            </p>
            <div className="landing-feature-grid">
              <article className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Video size={22} strokeWidth={2} />
                </div>
                <h3>Real-time room monitoring</h3>
                <p>
                  High-definition video and crystal clear audio with zero latency. Watch your little
                  one from anywhere in the world.
                </p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Brain size={22} strokeWidth={2} />
                </div>
                <h3>AI-based cry prediction</h3>
                <p>
                  Our patented AI distinguishes between hunger, discomfort, and tiredness, providing
                  you with actionable insights.
                </p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Bell size={22} strokeWidth={2} />
                </div>
                <h3>Smart Alert Escalation</h3>
                <p>
                  Notifications that matter. Automatically alert secondary guardians if the primary
                  parent is unavailable or hasn&apos;t responded.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-cta-wrap" id="demo">
          <div className="landing-cta-card">
            <h2>Ready for smarter, calmer parenting?</h2>
            <p>
              Join thousands of parents who have upgraded their nursery. Setup takes less than 5
              minutes.
            </p>
            <div className="landing-cta-buttons">
              <Link to="/signup" className="landing-btn landing-btn-cta-primary">
                Get Started for Free
              </Link>
              <a href="mailto:sales@example.com" className="landing-btn landing-btn-cta-secondary">
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-icon landing-logo-icon--sm" aria-hidden>
              <BrandLogoMark compact />
            </span>
            <span className="landing-footer-name">{BRAND}</span>
          </div>
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} Infant Cry Guard Inc. All rights reserved.
          </p>
          <div className="landing-footer-icons" aria-label="Social">
            <a href="#award" aria-label="Awards">
              <Award size={18} strokeWidth={1.5} />
            </a>
            <a href="#share" aria-label="Share">
              <Share2 size={18} strokeWidth={1.5} />
            </a>
            <a href="#camera" aria-label="Camera">
              <Camera size={18} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
