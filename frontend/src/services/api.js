/**
 * API origin. In Vite dev, use same-origin `/api` so the dev server proxies to :8080.
 * Otherwise call the backend on port 8080. Set `VITE_API_BASE` in `.env` to override (no trailing slash).
 */
const API_BASE =
  (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')) ||
  (import.meta.env.DEV ? '' : `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080`);

/**
 * Fetch the latest sensor data from MongoDB via the REST API.
 */
export async function fetchSensorData() {
  const res = await fetch(`${API_BASE}/api/sensor-data`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch sensor data: ${res.status}`);
  return res.json();
}

/**
 * Fetch sensor data history from MongoDB.
 * @param {number} limit - Number of records to fetch (default 50)
 */
export async function fetchSensorHistory(limit = 50) {
  const res = await fetch(`${API_BASE}/api/sensor-data/history?limit=${limit}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch sensor history: ${res.status}`);
  return res.json();
}

/**
 * Fetch the full system status from MongoDB.
 */
export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/api/status`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.status}`);
  return res.json();
}

/**
 * Fetch notifications from MongoDB.
 * @param {number} limit - Number of notifications to fetch (default 50)
 */
export async function fetchNotifications(limit = 50) {
  const res = await fetch(`${API_BASE}/api/notifications?limit=${limit}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}

function authHeaders() {
  const token = localStorage.getItem('cryguard_token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Evening care log, requires auth; `tz` is IANA timezone (e.g. from Intl). */
export async function fetchCareLogWindow(tz) {
  const q = new URLSearchParams({ tz: tz || 'UTC' }).toString();
  const res = await fetch(`${API_BASE}/api/care-logs/window?${q}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Window check failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchCareLogToday(tz) {
  const q = new URLSearchParams({ tz: tz || 'UTC' }).toString();
  const res = await fetch(`${API_BASE}/api/care-logs/me/today?${q}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to load today's log: ${res.status}`);
  return res.json();
}

/** Mongo-derived hints for daily care log (cry count, peak window, motion, intensity). */
export async function fetchCareLogSuggestions(tz, entryDate) {
  const q = new URLSearchParams({ tz: tz || 'UTC' });
  if (entryDate) q.set('entry_date', entryDate);
  const res = await fetch(`${API_BASE}/api/care-logs/suggestions?${q}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Suggestions failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Send a message to the LLM nursery coach agent.
 * @param {string} message - The user's message
 * @param {Array<{role:string, content:string}>} history - Prior conversation turns
 */
export async function sendChatMessage(message, history = []) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat request failed: ${res.status}`);
  }
  return res.json();
}

/** Live cry SMS escalation state (contacts row + event log). */
export async function fetchEscalationStatus() {
  const res = await fetch(`${API_BASE}/api/sms/escalation-status`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Escalation status failed: ${res.status}`);
  }
  return res.json();
}

/** Stop pending timed guardian SMS for the current cry escalation (authenticated). */
export async function acknowledgeCryAlert() {
  const res = await fetch(`${API_BASE}/api/sms/cry-alert/ack`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Ack failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Manual escalation SMS to Parent 2 or a guardian (during live cry alert).
 * @param {'parent2'|'guardian1'|'guardian2'} target
 * @param {{ message?: string, cry_label?: string }} [opts]
 */
export async function sendCryEscalationSms(target, opts = {}) {
  const res = await fetch(`${API_BASE}/api/sms/cry-alert/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      target,
      message: opts.message ?? null,
      cry_label: opts.cry_label ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `SMS failed: ${res.status}`);
  }
  return data;
}

export async function submitCareLog(payload) {
  const endpoints = ['/api/care-logs/submit', '/api/care-logs/submit/', '/api/care-logs', '/api/care-logs/'];
  let lastError = null;
  for (const ep of endpoints) {
    const res = await fetch(`${API_BASE}${ep}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;

    let msg = data.message;
    if (typeof data.detail === 'string') msg = data.detail;
    else if (Array.isArray(data.detail))
      msg = data.detail.map((x) => (typeof x === 'object' ? x.msg || JSON.stringify(x) : String(x))).join('; ');

    lastError = new Error(msg || `Save failed (${res.status})`);
    if (res.status !== 404 && res.status !== 405) throw lastError;
  }
  throw (
    lastError ||
    new Error(
      'Care-log endpoint is unavailable on this backend instance. Restart backend from the updated project code and try again.',
    )
  );
}
