import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ExploratoryChatPanel from './ExploratoryChatPanel';

const DEFAULT_SUGGESTIONS = [
  "What's the current humidity?",
  'How many cry alerts today?',
  'Is the room temperature safe?',
  'Summarise the last 24 hours',
];

export default function NurseryCoachFab({ title = 'Cry Guard Assistant', suggestions }) {
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
