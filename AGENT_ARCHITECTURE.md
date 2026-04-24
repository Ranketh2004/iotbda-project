# CryGuard Nursery Coach — Agent Architecture

## Overview

The Nursery Coach is a conversational AI agent that lets parents ask plain-language questions about their baby's environment and wellbeing. It is powered by **Qwen3 via OpenRouter** and is grounded in live data fetched from the CryGuard MongoDB database on every request.

---

## Architecture: Context-Injection Agent (RAG-style)

```
User message
     │
     ▼
┌─────────────────────────────────────────┐
│         POST /api/chat  (FastAPI)        │
│  • Optional JWT auth (care-log access)  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          chat_service.py                │
│                                         │
│  1. Fetch live context from MongoDB     │
│     ├─ Latest sensor reading            │
│     ├─ Last 100 sensor readings (stats) │
│     ├─ Last 30 cry-alert notifications  │
│     └─ Last 14 care logs (if authed)    │
│                                         │
│  2. Build structured system prompt      │
│     └─ Inject all fetched data as text  │
│                                         │
│  3. Prepend last 10 conversation turns  │
│                                         │
│  4. POST to OpenRouter (Qwen3)          │
│     └─ Return assistant reply           │
└─────────────────────────────────────────┘
                 │
                 ▼
        {"reply": "..."}
                 │
                 ▼
┌─────────────────────────────────────────┐
│       ExploratoryChatPanel.jsx          │
│  • Renders multi-turn conversation      │
│  • Shows typing indicator while loading │
│  • Maintains history in React state     │
│  • Passes last 10 turns with each call  │
└─────────────────────────────────────────┘
```

---

## Design Decisions

### Why Context-Injection instead of Tool-Calling?

Tool-calling (where the LLM decides what data to fetch) requires multiple round-trips and significantly increases latency. For a nursery dashboard where the full relevant dataset (sensor history, cry alerts, care logs) is small and fast to fetch from MongoDB, it is better to **always fetch everything** upfront and inject it into the system prompt. This gives the model full context immediately and keeps latency to a single LLM round-trip.

### Multi-turn conversation

Each request to `/api/chat` includes a `history` array (the prior conversation turns, capped at 10). This is prepended to the message list so the model can reference earlier questions and answers within the same session. History is stored in React component state and is not persisted to the database.

### Authentication

The `/api/chat` endpoint accepts an optional JWT Bearer token (same as all other protected routes). If a valid token is present, the agent also fetches and injects the user's personal **parent care logs** (feeding patterns, cry logs, nutrition entries). Without auth, the agent still has access to sensor data and cry alerts (which are not user-scoped).

### Model & Provider

| Setting | Value |
|---|---|
| Provider |
| Default model | `qwen/qwen3-30b-a3b:free` |
| Override | Set `OPENROUTER_MODEL` in `.env` |
| Max response tokens | 512 |
| Temperature | 0.7 |


---

## Data the Agent Can See

| Data source | Collection | Fields used |
|---|---|---|
| Live sensor | `sensor_data` | temperature, humidity, motion, light_dark, timestamp |
| Sensor history | `sensor_data` | last 100 rows — used for avg/min/max stats |
| Cry alerts | `notifications` | timestamp, message, type — last 30 |
| Parent care logs | `parent_care_logs` | entry_date, cry_frequency, cry_intensity_avg, feeding_type, feeding_frequency, water_intake, estimated_nutrition_level, time_of_day_peak_cry, motion_activity_level — last 14 days |
| ESP32 status | `esp_status` | last_seen (used to show connected/disconnected) |

---

## File Map

```
backend/
  services/chat_service.py   ← data fetching + system prompt + OpenRouter call
  routes/chat_routes.py      ← POST /api/chat endpoint
  config.py                  ← OPENROUTER_API_KEY, OPENROUTER_MODEL settings
.env                         ← OPENROUTER_API_KEY=<your key>

frontend/src/
  services/api.js                       ← sendChatMessage() helper
  components/ExploratoryChatPanel.jsx   ← multi-turn chat UI
  components/NurseryCoachFab.jsx        ← floating action button launcher
```

---

## Extending the Agent

**Add more data sources**: Edit `chat_service.py` — fetch additional MongoDB collections and append them to the system prompt string in `_build_system_prompt()`.

**Switch models**: Change `OPENROUTER_MODEL` in `.env` — any OpenAI-compatible model on OpenRouter works without code changes.

**Add streaming**: Replace the `httpx` POST in `chat_service.py` with a streaming request and return a `StreamingResponse` from the FastAPI route. Update the frontend to consume `text/event-stream`.

**Persist conversation history**: Store each session's `history` in MongoDB (keyed by user ID + session ID) and load it in `chat_routes.py` instead of reading it from the request body.
