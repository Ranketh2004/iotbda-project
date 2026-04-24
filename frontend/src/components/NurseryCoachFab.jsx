import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ExploratoryChatPanel from './ExploratoryChatPanel';

const DEFAULT_SUGGESTIONS = [
  "What's average humidity?",
  'How many cries in the last 24h?',
  'What should I do next?',
  'Top cry reasons?',
];

export default function NurseryCoachFab({ agentContext, title = 'Nursery coach', suggestions }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="coach-fab-root">
      <button
        type="button"
        className="coach-fab-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open nursery coach chat"
        title="Ask the nursery coach"
      >
        <MessageCircle size={22} strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <>
          <div
            className="coach-fab-backdrop"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <div
            className="coach-fab-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-fab-dialog-title"
          >
            <div className="coach-fab-drawer-bar" aria-hidden />
            <div className="coach-fab-drawer-head">
              <h2 id="coach-fab-dialog-title" className="coach-fab-drawer-title">
                {title}
              </h2>
              <button
                type="button"
                className="coach-fab-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="coach-fab-drawer-body">
              <ExploratoryChatPanel
                agentContext={agentContext}
                title={title}
                suggestions={suggestions ?? DEFAULT_SUGGESTIONS}
                hideHead
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
