import React, { useMemo, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { sendChatMessage } from '../services/api';

export default function ExploratoryChatPanel({
  title = 'Ask the nursery coach',
  suggestions,
  hideHead = false,
}) {
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content:
        'Hi! I have access to your live nursery data — sensor readings, cry alerts, and care logs. Ask me anything about your baby\'s environment or patterns.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const chips = useMemo(
    () =>
      suggestions || [
        "What's the current humidity?",
        'How many cry alerts today?',
        'Is the room temperature safe?',
        'Summarise the last 24 hours',
      ],
    [suggestions],
  );

  const scrollToBottom = () =>
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));

  const send = async (text) => {
    const t = String(text || '').trim();
    if (!t || loading) return;

    // Build the history the API expects (exclude the initial greeting from context)
    const apiHistory = messages
      .slice(1)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, { role: 'user', content: t }]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const { reply } = await sendChatMessage(t, apiHistory);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Sorry, I couldn't reach the AI service right now. (${err.message})`,
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <section
      className={`chat-panel${hideHead ? ' chat-panel--embedded' : ''}`}
      aria-label="Nursery coach chat"
    >
      {!hideHead ? (
        <div className="chat-panel-head">
          <MessageCircle size={20} className="chat-panel-ico" aria-hidden />
          <div>
            <h3 className="chat-panel-title">{title}</h3>
            <p className="chat-panel-sub">Powered by live nursery data + Qwen3 via OpenRouter</p>
          </div>
        </div>
      ) : null}

      <div className="chat-chips" role="list">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className="chat-chip"
            onClick={() => send(c)}
            disabled={loading}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="chat-log" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
            {m.content.split('\n').map((line, j) => (
              <p key={j} className="chat-line">
                {line}
              </p>
            ))}
          </div>
        ))}

        {loading ? (
          <div className="chat-bubble chat-bubble--assistant">
            <span className="chat-typing-dots" aria-label="Thinking">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : null}

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
          placeholder="Ask about humidity, cry patterns, feeding…"
          autoComplete="off"
          disabled={loading}
        />
        <button type="submit" className="chat-send" aria-label="Send" disabled={loading}>
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
