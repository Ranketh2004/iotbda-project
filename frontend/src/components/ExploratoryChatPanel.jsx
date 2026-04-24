import React, { useMemo, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { exploratoryAgentReply } from '../utils/analyticsData';

export default function ExploratoryChatPanel({
  agentContext,
  title = 'Ask the data coach',
  suggestions,
  hideHead = false,
}) {
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      text: 'I use your merged MongoDB nursery feed plus the infant cry & nutrition cohort CSV. Try a chip below or type your own question.',
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const chips = useMemo(
    () =>
      suggestions || [
        "What's average humidity?",
        'How many cries in the last 24h?',
        'What should I do next?',
        'Top cry reasons?',
      ],
    [suggestions],
  );

  const send = (text) => {
    const t = String(text || '').trim();
    if (!t) return;
    setMessages((m) => [...m, { role: 'user', text: t }]);
    const reply = exploratoryAgentReply(t, agentContext || {});
    setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    setInput('');
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  return (
    <section
      className={`chat-panel${hideHead ? ' chat-panel--embedded' : ''}`}
      aria-label="Exploratory analysis chat"
    >
      {!hideHead ? (
        <div className="chat-panel-head">
          <MessageCircle size={20} className="chat-panel-ico" aria-hidden />
          <div>
            <h3 className="chat-panel-title">{title}</h3>
            <p className="chat-panel-sub">Conversational exploration — no model keys required</p>
          </div>
        </div>
      ) : null}
      <div className="chat-chips" role="list">
        {chips.map((c) => (
          <button key={c} type="button" className="chat-chip" onClick={() => send(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="chat-log" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
            {m.text.split('\n').map((line, j) => (
              <p key={j} className="chat-line">
                {line}
              </p>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="expl-chat-input" className="visually-hidden">
          Message
        </label>
        <input
          id="expl-chat-input"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about patterns, humidity, or actions…"
          autoComplete="off"
        />
        <button type="submit" className="chat-send" aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
