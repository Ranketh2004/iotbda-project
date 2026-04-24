import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Moon,
  Sun,
  Activity as ActivityIcon,
  Volume2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

const DISMISSED_STORAGE_KEY = 'cryguard_timeline_dismissed';
const MAX_STORED_DISMISSED = 400;

function loadDismissedSet() {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistDismissedSet(set) {
  const arr = [...set].slice(-MAX_STORED_DISMISSED);
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore quota */
  }
}

const DEFAULT_DESCRIPTION = {
  lead:
    'A single feed of cry-related alerts and motion changes so you can see what happened recently at a glance.',
  // detail:
  //   'Live cry rows come from your account’s MongoDB notifications; motion “edges” are derived from merged sensor history (device + demo cohort). CSV cohort lines are synthetic diary samples aligned to the current week for charts — they are not new server writes. Use the checkboxes to choose entries, then remove them from this view only (hidden on this browser until you restore them).',
};

function normalizeDescription(description) {
  if (!description) return DEFAULT_DESCRIPTION;
  if (typeof description === 'string') return { lead: description, detail: '' };
  return {
    lead: description.lead ?? DEFAULT_DESCRIPTION.lead,
    detail: description.detail ?? DEFAULT_DESCRIPTION.detail,
  };
}

const KIND_ICON = {
  cry: Volume2,
  motion: ActivityIcon,
  light: Sun,
  rest: Moon,
};

const KIND_TONE = {
  cry: 'orange',
  motion: 'orange',
  light: 'blue',
  rest: 'blue',
};

export default function ActivityTimeline({ items, description }) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(loadDismissedSet);
  const [selected, setSelected] = useState(() => new Set());
  const panelId = useId();
  const listId = `${panelId}-list`;

  const desc = normalizeDescription(description);

  const rawItems = items?.length ? items : [];
  const visibleItems = useMemo(
    () => rawItems.filter((ev) => ev.id && !dismissed.has(ev.id)),
    [rawItems, dismissed],
  );

  const allHidden = rawItems.length > 0 && visibleItems.length === 0;

  const list = visibleItems.length
    ? visibleItems
    : allHidden
      ? [
          {
            id: 'all-dismissed',
            title: 'All timeline rows are hidden',
            timeLabel: '',
            detail: 'Use “Restore hidden” above to bring them back. Removing from view only affects this browser.',
            kind: 'rest',
          },
        ]
      : [
          {
            id: 'placeholder',
            title: 'Waiting for merged timeline',
            timeLabel: '',
            detail: 'Connect the device or refresh — cohort CSV still backs the merged timeline.',
            kind: 'rest',
          },
        ];

  const hasVisibleRows = visibleItems.length > 0;
  const isPlaceholder = !hasVisibleRows && !allHidden;

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      for (const id of prev) {
        if (visibleItems.some((ev) => ev.id === id)) next.add(id);
      }
      return next;
    });
  }, [visibleItems]);

  const showToolbar = hasVisibleRows || allHidden;

  const toggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const toggleSelect = useCallback((id) => {
    if (!id || id === 'placeholder') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visibleItems.map((ev) => ev.id)));
  }, [visibleItems]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const removeSelectedFromView = useCallback(() => {
    if (selected.size === 0) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const id of selected) next.add(id);
      persistDismissedSet(next);
      return next;
    });
    setSelected(new Set());
  }, [selected]);

  const restoreHidden = useCallback(() => {
    setDismissed(new Set());
    persistDismissedSet(new Set());
    setSelected(new Set());
  }, []);

  return (
    <section className="dash-timeline-card" aria-labelledby="timeline-heading">
      <div className="dash-timeline-head">
        <div className="dash-timeline-head-text">
          <h3 id="timeline-heading" className="dash-timeline-title">
            Activity timeline
          </h3>
        </div>
        <button
          type="button"
          className="dash-timeline-collapse"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={listId}
          title={expanded ? 'Collapse timeline' : 'Expand timeline'}
        >
          {expanded ? <ChevronUp size={22} strokeWidth={2.2} /> : <ChevronDown size={22} strokeWidth={2.2} />}
        </button>
      </div>
      <div className="dash-timeline-desc">
        <p className="dash-timeline-desc-lead">{desc.lead}</p>
        {desc.detail ? <p className="dash-timeline-desc-detail">{desc.detail}</p> : null}
      </div>
      {expanded && showToolbar && (
        <div className="dash-timeline-toolbar" role="toolbar" aria-label="Timeline selection">
          {hasVisibleRows && (
            <>
              <button type="button" className="dash-timeline-tool-btn" onClick={selectAllVisible}>
                Select all
              </button>
              <button
                type="button"
                className="dash-timeline-tool-btn"
                onClick={clearSelection}
                disabled={selected.size === 0}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="dash-timeline-tool-btn dash-timeline-tool-btn--primary"
                onClick={removeSelectedFromView}
                disabled={selected.size === 0}
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden />
                Remove selected from view
              </button>
            </>
          )}
          {dismissed.size > 0 && (
            <button type="button" className="dash-timeline-tool-btn dash-timeline-tool-btn--ghost" onClick={restoreHidden}>
              Restore hidden ({dismissed.size})
            </button>
          )}
        </div>
      )}
      {expanded && (
        <ol id={listId} className="dash-timeline-list">
          {list.map((ev, i) => {
            const Icon = KIND_ICON[ev.kind] || Moon;
            const tone = KIND_TONE[ev.kind] || 'blue';
            const last = i === list.length - 1;
            const timeLabel = ev.timeLabel != null ? ev.timeLabel : '';
            const detail = ev.detail != null ? ev.detail : ev.meta != null ? String(ev.meta) : '';
            const selectable = !isPlaceholder && ev.id !== 'placeholder';
            const checked = selectable && selected.has(ev.id);
            return (
              <li key={ev.id} className={`dash-timeline-item${selectable ? ' dash-timeline-item--selectable' : ''}`}>
                {selectable ? (
                  <label className="dash-timeline-check">
                    <input
                      type="checkbox"
                      className="dash-timeline-check-input"
                      checked={checked}
                      onChange={() => toggleSelect(ev.id)}
                      aria-label={`Select timeline row: ${ev.title}`}
                    />
                  </label>
                ) : (
                  <span className="dash-timeline-check-spacer" aria-hidden />
                )}
                <div className="dash-timeline-track">
                  <span className={`dash-timeline-dot dash-timeline-dot--${tone}`}>
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {!last && <span className="dash-timeline-line" aria-hidden />}
                </div>
                <div className="dash-timeline-body">
                  <p className="dash-timeline-event-title">{ev.title}</p>
                  {(timeLabel || detail) && (
                    <div className="dash-timeline-meta-block">
                      {timeLabel ? <p className="dash-timeline-time-row">{timeLabel}</p> : null}
                      {detail ? <p className="dash-timeline-detail-row">{detail}</p> : null}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
