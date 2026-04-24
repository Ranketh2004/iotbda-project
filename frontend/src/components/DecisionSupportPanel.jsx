import React from 'react';
import { Sparkles } from 'lucide-react';

export default function DecisionSupportPanel({ actions, compact }) {
  const list = actions?.length
    ? actions
    : [{ priority: 'low', title: 'Keep observing', detail: 'Merged data will populate suggestions automatically.' }];

  return (
    <section className={`decision-panel ${compact ? 'decision-panel--compact' : ''}`} aria-label="Decision support">
      <div className="decision-panel-head">
        <Sparkles size={20} className="decision-panel-ico" aria-hidden />
        <div>
          <h3 className="decision-panel-title">Suggested next steps</h3>
          <p className="decision-panel-sub">Rule-based guidance from your merged nursery signals</p>
        </div>
      </div>
      <ul className="decision-panel-list">
        {list.map((a) => (
          <li key={a.title} className={`decision-panel-item decision-panel-item--${a.priority || 'medium'}`}>
            <p className="decision-panel-item-title">{a.title}</p>
            <p className="decision-panel-item-detail">{a.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
