import React from 'react';
import { Moon, Sun, Activity as ActivityIcon } from 'lucide-react';

const EVENTS = [
  {
    id: '1',
    title: 'Deep Sleep Detected',
    meta: '2:30 PM • 1h 45m duration',
    icon: Moon,
    tone: 'blue',
  },
  {
    id: '2',
    title: 'Slight Movement',
    meta: '1:15 PM • Crib shaking detected',
    icon: ActivityIcon,
    tone: 'orange',
  },
  {
    id: '3',
    title: 'Woke Up - Brief',
    meta: '11:00 AM • Morning cycle ended',
    icon: Sun,
    tone: 'blue',
  },
];

export default function ActivityTimeline() {
  return (
    <section className="dash-timeline-card" aria-labelledby="timeline-heading">
      <h3 id="timeline-heading" className="dash-timeline-title">
        Activity Timeline
      </h3>
      <ol className="dash-timeline-list">
        {EVENTS.map((ev, i) => {
          const Icon = ev.icon;
          const last = i === EVENTS.length - 1;
          return (
            <li key={ev.id} className="dash-timeline-item">
              <div className="dash-timeline-track">
                <span className={`dash-timeline-dot dash-timeline-dot--${ev.tone}`}>
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
