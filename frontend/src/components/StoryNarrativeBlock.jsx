import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

export default function StoryNarrativeBlock({ chapters, title = "Today's data story" }) {
  const [open, setOpen] = useState(0);
  const list = chapters?.length ? chapters : [{ title: 'No chapters yet', body: 'Load sensor history to unlock narrative beats.' }];

  return (
    <section className="story-block" aria-label="Data story">
      <div className="story-block-head">
        <BookOpen size={20} className="story-block-ico" aria-hidden />
        <div>
          <h3 className="story-block-title">{title}</h3>
          <p className="story-block-sub">Storytelling layer — scan, then drill into Analytics</p>
        </div>
      </div>
      <ol className="story-chapter-list">
        {list.map((ch, i) => {
          const isOpen = open === i;
          return (
            <li key={ch.title} className="story-chapter">
              <button
                type="button"
                className="story-chapter-toggle"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
              >
                <span className="story-chapter-kicker">Chapter {i + 1}</span>
                <span className="story-chapter-title-text">{ch.title}</span>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {isOpen && <p className="story-chapter-body">{ch.body}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
