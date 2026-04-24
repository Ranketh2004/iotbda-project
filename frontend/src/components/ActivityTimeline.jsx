import React from 'react';
import { Moon, Sun, Activity as ActivityIcon, Volume2 } from 'lucide-react';

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

export default function ActivityTimeline({ items }) {
  const list = items?.length
    ? items
    : [
        {
          id: 'placeholder',
          title: 'Waiting for merged timeline',
          meta: 'Connect the device or refresh — cohort CSV still backs the merged timeline.',
          kind: 'rest',
        },
      ];

  return (
    <section className="dash-timeline-card" aria-labelledby="timeline-heading">
      <h3 id="timeline-heading" className="dash-timeline-title">
        Activity timeline
      </h3>
      <p className="dash-timeline-sub">Cry alerts and motion edges from MongoDB + nutrition cohort CSV</p>
      <ol className="dash-timeline-list">
        {list.map((ev, i) => {
          const Icon = KIND_ICON[ev.kind] || Moon;
          const tone = KIND_TONE[ev.kind] || 'blue';
          const last = i === list.length - 1;
          return (
            <li key={ev.id} className="dash-timeline-item">
              <div className="dash-timeline-track">
                <span className={`dash-timeline-dot dash-timeline-dot--${tone}`}>
                  <Icon size={16} strokeWidth={2} />
                </span>
                {!last && <span className="dash-timeline-line" aria-hidden />}
              </div>
              <div className="dash-timeline-body">
                <p className="dash-timeline-event-title">{ev.title}</p>
                <p className="dash-timeline-event-meta">{ev.meta}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
