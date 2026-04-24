import nutritionCsvRaw from '../data/infant_cry_nutrition_data.csv?raw';

const nowSec = () => Date.now() / 1000;

/** Max cohort rows expanded from CSV (keeps merge + charts responsive). */
const MAX_CSV_ROWS = 450;
/** Cap synthetic alerts generated per CSV row. */
const MAX_CRIES_PER_ROW = 10;
/** Only use cohort diary dates in this window (UTC day span) so charts overlap recent buckets. */
const COHORT_DATE_WINDOW_SEC = 21 * 86400;

let _nutritionRowsCache = null;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"') {
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        if (line[i] === '"') {
          i++;
          break;
        }
        cur += line[i];
        i++;
      }
      continue;
    }
    if (c === ',') {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur);
  return out;
}

function dayNoonUtcSec(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return Date.UTC(y, mo, d, 12, 0, 0) / 1000;
}

export function parseNutritionCsvRows(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    if (cells.length < header.length) continue;
    const o = {};
    for (let i = 0; i < header.length; i++) {
      o[header[i]] = cells[i] != null ? String(cells[i]).trim() : '';
    }
    rows.push(o);
  }
  return rows;
}

function getNutritionRows() {
  if (_nutritionRowsCache) return _nutritionRowsCache;
  _nutritionRowsCache = parseNutritionCsvRows(nutritionCsvRaw);
  return _nutritionRowsCache;
}

function peakWindowHours(peak) {
  const p = String(peak || '').toLowerCase();
  if (p.includes('night')) return { start: 20, span: 5 };
  if (p.includes('afternoon')) return { start: 13, span: 6 };
  if (p.includes('morning')) return { start: 6, span: 6 };
  return { start: 11, span: 8 };
}

function inferReasonFromCsvRow(row) {
  const nutrition = String(row.estimated_nutrition_level || '').toLowerCase();
  const meal = String(row.meal_timing_pattern || '').toLowerCase();
  const peak = String(row.time_of_day_peak_cry || '').toLowerCase();
  const intensity = String(row.cry_intensity_avg || '').toLowerCase();
  const feeding = String(row.feeding_type || '').toLowerCase();
  if (nutrition.includes('low') || (feeding.includes('formula') && String(row.water_intake || '').toLowerCase() === 'low')) {
    return 'hungry';
  }
  if (peak.includes('night') || (meal.includes('irregular') && intensity.includes('high'))) {
    return 'tired';
  }
  if (intensity.includes('high') || String(row.motion_activity_level || '').toLowerCase() === 'high') {
    return 'discomfort';
  }
  if (nutrition.includes('balanced') || nutrition.includes('high')) {
    return 'hungry';
  }
  return 'discomfort';
}

function globalCsvMaxDaySec() {
  const all = getNutritionRows();
  let maxDay = 0;
  for (const r of all) {
    const t = dayNoonUtcSec(r.date);
    if (t != null && t > maxDay) maxDay = t;
  }
  return maxDay;
}

/** Aligns the newest diary dates in the CSV to the current wall clock (for chart buckets). */
function csvTimeShiftSec() {
  const maxDay = globalCsvMaxDaySec();
  if (!maxDay) return 0;
  return nowSec() - maxDay - 3600 * 6;
}

function cohortRowsForAnalytics() {
  const all = getNutritionRows();
  if (!all.length) return [];
  const maxDay = globalCsvMaxDaySec();
  if (!maxDay) return [];
  const cutoff = maxDay - COHORT_DATE_WINDOW_SEC;
  const filtered = all.filter((r) => {
    const t = dayNoonUtcSec(r.date);
    return t != null && t >= cutoff && t <= maxDay;
  });
  filtered.sort((a, b) => (dayNoonUtcSec(a.date) || 0) - (dayNoonUtcSec(b.date) || 0));
  return filtered.slice(-MAX_CSV_ROWS);
}

function motionFromLevel(level) {
  const l = String(level || '').toLowerCase();
  return l === 'high';
}

function pseudoEnvFromRow(row, idx) {
  const freq = Math.min(MAX_CRIES_PER_ROW, Math.max(0, parseInt(row.cry_frequency, 10) || 0));
  const inten = String(row.cry_intensity_avg || '').toLowerCase();
  const baseHum = inten.includes('high') ? 72 : inten.includes('low') ? 62 : 66;
  const hum = baseHum + (idx % 7) - 3;
  const baseTemp = inten.includes('high') ? 27.4 : inten.includes('low') ? 26.2 : 26.8;
  const temperature = baseTemp + (idx % 5) * 0.15;
  const light_dark = peakWindowHours(row.time_of_day_peak_cry).start >= 18;
  return { temperature, humidity: hum, motion: motionFromLevel(row.motion_activity_level), light_dark };
}

/**
 * Sensor-shaped points from the nutrition cohort (for merge when Mongo is sparse).
 */
export function getCsvSensorHistory() {
  const rows = cohortRowsForAnalytics();
  if (!rows.length) return [];
  const shift = csvTimeShiftSec();
  const out = [];
  let i = 0;
  for (const r of rows) {
    const noon = dayNoonUtcSec(r.date);
    if (noon == null) continue;
    const { start, span } = peakWindowHours(r.time_of_day_peak_cry);
    const ts = noon + shift + (start + span / 2) * 3600;
    const env = pseudoEnvFromRow(r, i);
    out.push({ ...env, timestamp: ts });
    i++;
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function cryMessageFromRow(row, idx, total) {
  const parts = [
    `Cohort log ${row.baby_id || 'baby'} — cry ${idx + 1}/${total} on ${row.date || '?'}.`,
    `Intensity ${row.cry_intensity_avg || 'n/a'}, feeding: ${row.feeding_type || 'n/a'} (${row.main_food_types || 'n/a'}).`,
    `Nutrition signal: ${row.estimated_nutrition_level || 'n/a'}; peak fuss: ${row.time_of_day_peak_cry || 'n/a'}.`,
  ];
  return parts.join(' ');
}

/**
 * Notification-shaped alerts expanded from daily cry_frequency + nutrition context.
 */
export function getCsvNotifications() {
  const rows = cohortRowsForAnalytics();
  if (!rows.length) return [];
  const shift = csvTimeShiftSec();
  const list = [];
  for (const r of rows) {
    const noon = dayNoonUtcSec(r.date);
    if (noon == null) continue;
    const { start, span } = peakWindowHours(r.time_of_day_peak_cry);
    const base = noon + shift + start * 3600;
    const n = Math.min(MAX_CRIES_PER_ROW, Math.max(1, parseInt(r.cry_frequency, 10) || 1));
    const step = n <= 1 ? 0 : (span * 3600) / n;
    for (let j = 0; j < n; j++) {
      const ts = base + j * step + (String(r.baby_id || '').length % 120);
      list.push({
        timestamp: ts,
        type: 'cry_alert',
        message: cryMessageFromRow(r, j, n),
      });
    }
  }
  return list.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Structured cry-style events (one per cohort row) for richer merged timeline cards.
 */
export function getCsvCryEvents() {
  const full = cohortRowsForAnalytics();
  if (!full.length) return [];
  const rows = full.slice(-Math.min(80, full.length));
  const shift = csvTimeShiftSec();
  const out = [];
  let idx = 0;
  for (const r of rows) {
    const noon = dayNoonUtcSec(r.date);
    if (noon == null) continue;
    const { start, span } = peakWindowHours(r.time_of_day_peak_cry);
    const ts = noon + shift + (start + span / 2) * 3600;
    const reason = inferReasonFromCsvRow(r);
    const freq = parseInt(r.cry_frequency, 10) || 0;
    const intensity = String(r.cry_intensity_avg || '').toLowerCase();
    const severity = freq >= 10 || intensity.includes('high') ? 'critical' : 'mild';
    const confidence = severity === 'critical' ? 78 + (idx % 15) : 64 + (idx % 12);
    const confidenceVariant = confidence >= 85 ? 'green' : confidence >= 75 ? 'yellow' : 'grey';
    const peak = String(r.time_of_day_peak_cry || '');
    const light_dark = peak.toLowerCase().includes('night');
    out.push({
      timestamp: ts,
      reason,
      severity,
      confidence,
      confidenceVariant,
      footerLeft: `${r.feeding_type || 'Feed'} · ${r.main_food_types || 'foods'} · ${r.estimated_nutrition_level || 'nutrition'} · ${freq} cries logged`,
      footerMid: `${r.day_type || ''} ${r.meal_timing_pattern || ''}`.trim() || null,
      escalation: freq >= 11 ? 'triggered' : null,
      motion: motionFromLevel(r.motion_activity_level) ? 'Detected' : 'None',
      lightLabel: light_dark ? 'Dark' : 'Bright',
      lightIcon: light_dark ? 'moon' : 'sun',
    });
    idx++;
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

export function normalizeSensorRow(row) {
  if (!row) return null;
  const ts = row.timestamp != null ? Number(row.timestamp) : null;
  return {
    temperature: row.temperature != null ? Number(row.temperature) : null,
    humidity: row.humidity != null ? Number(row.humidity) : null,
    motion: Boolean(row.motion),
    light_dark: Boolean(row.light_dark),
    timestamp: ts,
  };
}

/** Merge MongoDB history with CSV-derived cohort points; drop near-identical duplicates in a short time window. */
export function mergeSensorHistory(mongoRows, csvRows, opts = {}) {
  const windowSec = opts.dedupeWindowSec ?? 90;
  const mongo = (mongoRows || []).map(normalizeSensorRow).filter((r) => r.timestamp != null);
  const cohort = (csvRows || []).map(normalizeSensorRow).filter((r) => r.timestamp != null);
  const combined = [...mongo, ...cohort].sort((a, b) => a.timestamp - b.timestamp);
  const out = [];
  for (const r of combined) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.timestamp - r.timestamp) < windowSec &&
      last.temperature === r.temperature &&
      last.humidity === r.humidity &&
      last.motion === r.motion &&
      last.light_dark === r.light_dark
    ) {
      continue;
    }
    out.push(r);
  }
  return out;
}

export function mergeNotifications(mongoList, csvList) {
  const m = mongoList || [];
  const s = csvList || [];
  const map = new Map();
  let syntheticKey = 0;
  for (const n of [...m, ...s]) {
    const ts = Number(n.timestamp);
    if (!Number.isFinite(ts)) continue;
    // Mongo docs must dedupe by _id only — old key used ts.toFixed(0)+message and dropped distinct
    // alerts in the same second with the same template (e.g. multiple cry_label values).
    const id = n._id != null && n._id !== '' ? String(n._id) : '';
    const key = id
      ? `id:${id}`
      : `syn:${ts}:${String(n.cry_label ?? n.label ?? '')}:${(n.message || '').slice(0, 48)}:${syntheticKey++}`;
    if (!map.has(key)) map.set(key, { ...n, timestamp: ts });
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

/** Canonical `notifications.cry_label` / multiclass model buckets (display order). */
export const LENS_REASON_SLUGS = [
  'belly pain',
  'burping',
  'cold_hot',
  'discomfort',
  'hungry',
  'tired',
];

const LENS_REASON_SET = new Set(LENS_REASON_SLUGS);

function compactCryKey(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, '');
}

const COMPACT_TO_LENS_SLUG = {
  bellypain: 'belly pain',
  burping: 'burping',
  coldhot: 'cold_hot',
  discomfort: 'discomfort',
  hungry: 'hungry',
  tired: 'tired',
  tiredsleepy: 'tired',
};

/**
 * Normalize a `notifications.cry_label` (or legacy UI string) to a LENS_REASON_SLUG, or null if unknown / non-reason.
 */
export function normalizeCryLabel(raw) {
  if (raw == null) return null;
  let t = String(raw).replace(/\uFEFF/g, '').trim();
  if (!t) return null;
  // Normalize unusual spaces (NBSP, etc.) so "belly pain" from DB always matches.
  t = t.replace(/\s+/gu, ' ').trim();
  const lower = t.toLowerCase();
  if (['cry', 'no_cry', 'no cry', 'unknown'].includes(lower)) return null;
  if (LENS_REASON_SET.has(lower)) return lower;
  const spaced = lower.replace(/\s+/g, ' ');
  if (LENS_REASON_SET.has(spaced)) return spaced;
  const c = compactCryKey(t);
  if (COMPACT_TO_LENS_SLUG[c]) return COMPACT_TO_LENS_SLUG[c];
  return null;
}

/**
 * Infer one of the six lens labels from free text (fallback when cry_label is missing).
 * More specific patterns first. Returns null when nothing matches.
 */
export function inferReasonFromMessage(message) {
  const m = String(message || '').toLowerCase();
  if (!m.trim()) return null;
  if (/\bburp|\bbelch|\bgas\b/.test(m)) return 'burping';
  if (/belly|stomach|colic|cramp|abdominal|tummy/.test(m)) return 'belly pain';
  if (/cold|chill|fever|overheat|too\s*hot|too\s*cold|sweat(ing)?/.test(m)) return 'cold_hot';
  if (/discomfort|warm|humidity|diaper|position|environmental/.test(m)) return 'discomfort';
  if (/hunger|hungry|feeding|\bfeed\b/.test(m)) return 'hungry';
  if (/tired|sleep|sleepy|low energy/.test(m)) return 'tired';
  return null;
}

/**
 * Map a merged cry event to a lens bucket: prefer Mongo `cry_label`, then structured reason, then message text.
 */
export function classifyCryReason(event) {
  const fromDb = normalizeCryLabel(event?.cry_label ?? event?.label);
  if (fromDb) return fromDb;
  const fromReason = normalizeCryLabel(event?.reason);
  if (fromReason) return fromReason;
  const text = String(event?.rawMessage ?? event?.footerLeft ?? event?.message ?? '');
  if (text) {
    const inf = inferReasonFromMessage(text);
    if (inf) return inf;
  }
  const r = String(event?.reason || '').trim();
  if (r) {
    const inf2 = inferReasonFromMessage(r);
    if (inf2) return inf2;
  }
  return null;
}

/** Cry reason lens grid: slug → short label (matches multiclass / cry_label vocabulary). */
export const LENS_GRID_ORDER = [
  ['belly pain', 'BELLY PAIN'],
  ['burping', 'BURPING'],
  ['cold_hot', 'COLD / HOT'],
  ['discomfort', 'DISCOMFORT'],
  ['hungry', 'HUNGRY'],
  ['tired', 'TIRED'],
];

/**
 * Per-bucket counts for lens categories. Total is the sum of labeled events only (unlabeled excluded).
 */
export function lensReasonBreakdown(events) {
  const counts = Object.fromEntries(LENS_REASON_SLUGS.map((k) => [k, 0]));
  for (const e of events || []) {
    const c = classifyCryReason(e);
    if (c && counts[c] !== undefined) counts[c]++;
  }
  const total = LENS_REASON_SLUGS.reduce((s, k) => s + counts[k], 0);
  return { counts, total };
}

/** Histogram-shaped list for `fromDistribution` (includes zeros). */
export function lensReasonHistogram(events) {
  const { counts } = lensReasonBreakdown(events);
  return LENS_REASON_SLUGS.map((reason) => ({ reason, count: counts[reason] }));
}

/**
 * Lens counts from notification documents only (`cry_label`). No CSV cohort rows, no message inference.
 */
export function lensReasonBreakdownFromCryLabels(notifications) {
  const counts = Object.fromEntries(LENS_REASON_SLUGS.map((k) => [k, 0]));
  for (const n of notifications || []) {
    const raw = n?.cry_label ?? n?.label;
    const c = normalizeCryLabel(raw);
    if (c && counts[c] !== undefined) counts[c]++;
  }
  const total = LENS_REASON_SLUGS.reduce((s, k) => s + counts[k], 0);
  return { counts, total };
}

export function lensReasonHistogramFromCryLabels(notifications) {
  const { counts } = lensReasonBreakdownFromCryLabels(notifications);
  return LENS_REASON_SLUGS.map((reason) => ({ reason, count: counts[reason] }));
}

/** Same shape as `reasonHistogram`, from Mongo `cry_label` only. */
export function reasonHistogramFromCryLabels(notifications) {
  const { counts } = lensReasonBreakdownFromCryLabels(notifications);
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}
function nearestSensorAt(sensors, ts) {
  if (!sensors.length) return null;
  let best = sensors[0];
  let bestD = Math.abs(sensors[0].timestamp - ts);
  for (let i = 1; i < sensors.length; i++) {
    const d = Math.abs(sensors[i].timestamp - ts);
    if (d < bestD) {
      bestD = d;
      best = sensors[i];
    }
  }
  return best;
}

export function enrichNotificationAsEvent(n, sensors) {
  const ts = Number(n.timestamp);
  const sn = nearestSensorAt(sensors, ts);
  const rawLabel = n.cry_label ?? n.label;
  const fromLabel = normalizeCryLabel(rawLabel);
  const reason = fromLabel ?? inferReasonFromMessage(n.message) ?? 'unlabeled';
  const severity =
    /cluster|third|sustained|spike|warm|discomfort|intensity\s+high/i.test(String(n.message)) ? 'critical' : 'mild';
  const confidence =
    severity === 'critical' ? 72 + Math.floor((ts % 17) % 18) : 62 + Math.floor((ts % 11) % 12);
  const confidenceVariant =
    confidence >= 85 ? 'green' : confidence >= 75 ? 'yellow' : 'grey';
  const tempStr =
    sn?.temperature != null ? `${Number(sn.temperature).toFixed(0)}°C` : '—';
  const humStr = sn?.humidity != null ? `${Number(sn.humidity).toFixed(0)}%` : '—';
  const lightLabel = sn ? (sn.light_dark ? 'Dark' : 'Bright') : '—';
  const lightIcon = sn?.light_dark ? 'moon' : 'sun';
  return {
    id: `n-${ts}`,
    cry_label: rawLabel != null ? String(rawLabel) : undefined,
    reason,
    severity,
    confidence,
    confidenceVariant,
    timestamp: ts,
    icon: reason === 'tired' ? 'moon' : reason === 'discomfort' ? 'circle' : 'frown',
    iconTone: reason === 'tired' ? 'yellow' : reason === 'discomfort' ? 'grey' : 'blue',
    temp: tempStr,
    humidity: humStr,
    light: lightLabel,
    lightIcon,
    footerLeft: String(n.message || '').slice(0, 120),
    footerMid: null,
    escalation: /cluster|third alert|escalat|triggered/i.test(String(n.message)) ? 'triggered' : null,
    motion: sn?.motion ? 'Detected' : 'None',
    rawMessage: n.message != null ? String(n.message) : '',
    message: n.message != null ? String(n.message) : '',
  };
}

export function mergeCryEvents(csvStructuredEvents, notifications, sensors) {
  const fromCsv = (csvStructuredEvents || []).map((e) => {
    const ts = Number(e.timestamp);
    const sn = nearestSensorAt(sensors, ts);
    const iconTone =
      e.iconTone ||
      (e.reason === 'tired' ? 'yellow' : e.reason === 'discomfort' ? 'grey' : 'blue');
    return {
      id: `c-${ts}-${e.reason}`,
      reason: e.reason,
      severity: e.severity,
      confidence: e.confidence,
      confidenceVariant: e.confidenceVariant,
      timestamp: ts,
      icon: e.reason === 'tired' ? 'moon' : e.reason === 'discomfort' ? 'circle' : 'frown',
      iconTone,
      temp: sn?.temperature != null ? `${Number(sn.temperature).toFixed(0)}°C` : '—',
      humidity: sn?.humidity != null ? `${Number(sn.humidity).toFixed(0)}%` : '—',
      light: e.lightLabel ?? (sn?.light_dark ? 'Dark' : 'Bright'),
      lightIcon: e.lightIcon || (sn?.light_dark ? 'moon' : 'sun'),
      footerLeft: e.footerLeft,
      footerMid: e.footerMid,
      escalation: e.escalation,
      motion: e.motion,
      rawMessage: null,
    };
  });
  const fromMongo = (notifications || []).map((n) => enrichNotificationAsEvent(n, sensors));
  const byTs = new Map();
  for (const ev of [...fromMongo, ...fromCsv]) {
    const k = `${ev.timestamp.toFixed(0)}-${ev.reason}`;
    if (!byTs.has(k)) byTs.set(k, ev);
  }
  return Array.from(byTs.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function formatEventTime(ts) {
  try {
    const d = new Date(ts * 1000);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function reasonHistogram(events) {
  const { counts } = lensReasonBreakdown(events);
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function cryAlertsLast24h(events) {
  const t0 = nowSec() - 86400;
  return (events || []).filter((e) => e.timestamp >= t0).length;
}

export function avgHumidity(sensors) {
  const vals = (sensors || []).map((s) => s.humidity).filter((v) => v != null && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function avgTemp(sensors) {
  const vals = (sensors || []).map((s) => s.temperature).filter((v) => v != null && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function meanArr(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pearsonCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const sliceX = xs.slice(0, n);
  const sliceY = ys.slice(0, n);
  const mx = meanArr(sliceX);
  const my = meanArr(sliceY);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = sliceX[i] - mx;
    const vy = sliceY[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den < 1e-12) return 0;
  return num / den;
}

function standardizeArr(xs) {
  const m = meanArr(xs);
  const denom = Math.max(xs.length - 1, 1);
  const dev = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / denom);
  const s = dev < 1e-9 ? 1 : dev;
  return xs.map((x) => (x - m) / s);
}

/** Gauss–Jordan; A is n×n (modified in place); returns x or null if singular. */
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const div = M[col][col];
    for (let k = col; k <= n; k++) M[col][k] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-15) continue;
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Pearson correlations between temp, humidity, motion, and light (dark=1),
 * plus a small ridge regression (humidity ~ standardized temp, motion, light) as a linear proxy for “feature importance”.
 */
export function computeSensorCorrelationAnalysis(sensors, opts = {}) {
  const ridgeLambda = opts.ridgeLambda ?? 0.12;
  const minSamples = opts.minSamples ?? 8;
  const rows = [];
  for (const s of sensors || []) {
    const t = Number(s.temperature);
    const h = Number(s.humidity);
    if (!Number.isFinite(t) || !Number.isFinite(h)) continue;
    const m = s.motion ? 1 : 0;
    const l = s.light_dark ? 1 : 0;
    rows.push({ t, h, m, l });
  }
  const n = rows.length;
  if (n < minSamples) {
    return {
      ok: false,
      n,
      minSamples,
      message: `We need at least ${minSamples} room readings that include both temperature and humidity. Open the dashboard with the sensor running for a bit, then check back.`,
    };
  }

  const ts = rows.map((r) => r.t);
  const hs = rows.map((r) => r.h);
  const ms = rows.map((r) => r.m);
  const ls = rows.map((r) => r.l);

  const shortLabels = ['Temperature', 'Humidity', 'Movement', 'Dark room'];
  const vecs = [ts, hs, ms, ls];
  const dim = shortLabels.length;

  const matrix = [];
  for (let i = 0; i < dim; i++) {
    const row = [];
    for (let j = 0; j < dim; j++) {
      if (i === j) {
        row.push(1);
        continue;
      }
      const r = pearsonCorrelation(vecs[i], vecs[j]);
      row.push(r == null ? null : Math.round(r * 1000) / 1000);
    }
    matrix.push(row);
  }

  const pairs = [];
  for (let i = 0; i < dim; i++) {
    for (let j = i + 1; j < dim; j++) {
      const r = pearsonCorrelation(vecs[i], vecs[j]);
      pairs.push({
        a: shortLabels[i],
        b: shortLabels[j],
        r: r == null ? null : Math.round(r * 1000) / 1000,
      });
    }
  }
  pairs.sort((a, b) => {
    const av = a.r == null ? 0 : Math.abs(a.r);
    const bv = b.r == null ? 0 : Math.abs(b.r);
    return bv - av;
  });

  const tZ = standardizeArr(ts);
  const mZ = standardizeArr(ms);
  const lZ = standardizeArr(ls);
  const hRaw = [...hs];
  const p = 4;
  const XtX = Array(p)
    .fill(0)
    .map(() => Array(p).fill(0));
  const Xty = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = [1, tZ[i], mZ[i], lZ[i]];
    const yi = hRaw[i];
    for (let a = 0; a < p; a++) {
      Xty[a] += xi[a] * yi;
      for (let b = 0; b < p; b++) XtX[a][b] += xi[a] * xi[b];
    }
  }
  const A = XtX.map((r) => [...r]);
  for (let d = 1; d < p; d++) A[d][d] += ridgeLambda;

  const beta = solveLinearSystem(A, [...Xty]);
  if (!beta) {
    return {
      ok: false,
      n,
      message: 'Not enough variety in the readings to compare factors yet. Try again after more sensor history.',
      matrix,
      pairs,
      shortLabels,
    };
  }

  const betaNames = ['Baseline', 'Temperature', 'Movement', 'Dark room'];
  const betas = betaNames.map((name, i) => ({
    name,
    value: Math.round(beta[i] * 1000) / 1000,
  }));

  const absSlopes = [
    { feature: 'Temperature', signed: beta[1], absBeta: Math.abs(beta[1]) },
    { feature: 'Motion', signed: beta[2], absBeta: Math.abs(beta[2]) },
    { feature: 'Dark room', signed: beta[3], absBeta: Math.abs(beta[3]) },
  ];
  const sumAbs = absSlopes.reduce((s, x) => s + x.absBeta, 0) || 1;
  const importance = absSlopes
    .map((x) => ({
      feature: x.feature,
      signed: Math.round(x.signed * 1000) / 1000,
      absBeta: Math.round(x.absBeta * 1000) / 1000,
      pct: Math.round((x.absBeta / sumAbs) * 1000) / 10,
    }))
    .sort((a, b) => b.absBeta - a.absBeta);

  const sortedT = [...ts].sort((a, b) => a - b);
  const medT = sortedT[Math.floor(sortedT.length / 2)];
  const below = rows.filter((r) => r.t < medT);
  const above = rows.filter((r) => r.t >= medT);
  const meanHBelow = meanArr(below.map((r) => r.h));
  const meanHAbove = meanArr(above.map((r) => r.h));

  return {
    ok: true,
    n,
    ridgeLambda,
    shortLabels,
    matrix,
    pairs,
    betas,
    importance,
    stratified: {
      threshold: Math.round(medT * 100) / 100,
      meanHumidityBelow: Math.round(meanHBelow * 10) / 10,
      meanHumidityAbove: Math.round(meanHAbove * 10) / 10,
      delta: Math.round((meanHAbove - meanHBelow) * 10) / 10,
      nBelow: below.length,
      nAbove: above.length,
    },
  };
}

export function buildStoryChapters({ sensors, events, liveTemp, liveHum, cryStatus }) {
  const chapters = [];
  const last24 = (sensors || []).filter((s) => s.timestamp >= nowSec() - 86400);
  const hum = avgHumidity(last24.length ? last24 : sensors);
  const temp = avgTemp(last24.length ? last24 : sensors);
  const top = reasonHistogram(events)[0];

  chapters.push({
    title: 'Opening scene',
    body: `Over the last few days we combined your MongoDB nursery stream with the infant cry & nutrition cohort CSV (aligned to this week for charts)${liveTemp != null ? ` (${Number(liveTemp).toFixed(1)}°C now` : ''}${
      liveHum != null ? `, ${Number(liveHum).toFixed(0)}% humidity` : ''
    }${liveTemp != null || liveHum != null ? ')' : ''}. The timeline highlights when cries line up with motion or room shifts.`,
  });

  if (top) {
    chapters.push({
      title: 'Pattern',
      body: `The leading interpreted reason is “${top.reason}” (${top.count} recorded events in the merged window). Use filters on the Analytics tab to compare critical versus mild episodes.`,
    });
  }

  if (hum != null && hum > 70) {
    chapters.push({
      title: 'Environment beat',
      body: `Average humidity is around ${hum.toFixed(
        0,
      )}% — on the high side for Colombo-area nurseries. Ventilation or a compact dehumidifier during sleep blocks often reduces false “discomfort” spikes.`,
    });
  } else if (hum != null) {
    chapters.push({
      title: 'Environment beat',
      body: `Humidity has stayed near ${hum.toFixed(
        0,
      )}%, which is comfortable for most infants. Keep monitoring after weather swings.`,
    });
  }

  if (cryStatus?.cry_detected) {
    chapters.push({
      title: 'Right now',
      body: `Live model output: ${String(cryStatus.message || 'Activity detected').slice(0, 160)}`,
    });
  } else {
    chapters.push({
      title: 'Right now',
      body: 'No active cry flag from the live stream. Historical bars still reflect MongoDB plus the nutrition cohort for planning.',
    });
  }

  return chapters;
}

export function buildDecisionSupport({ sensors, events }) {
  const actions = [];
  const hum = avgHumidity(sensors);
  const last24ev = (events || []).filter((e) => e.timestamp >= nowSec() - 86400);
  const critical = last24ev.filter((e) => e.severity === 'critical').length;

  if (hum != null && hum > 71) {
    actions.push({
      priority: 'high',
      title: 'Humidity comfort',
      detail:
        'Aim for air exchange before nap: cracked window with fan (not on baby) or A/C dry mode 20 minutes.',
    });
  }
  if (critical >= 3) {
    actions.push({
      priority: 'high',
      title: 'Escalation readiness',
      detail:
        'Several critical-tagged cries in 24h. Confirm feeding log and consider shortening wake windows by 10–15 minutes.',
    });
  }
  const hungry = (events || []).filter((e) => classifyCryReason(e) === 'hungry').length;
  if (hungry >= 4) {
    actions.push({
      priority: 'medium',
      title: 'Feeding rhythm',
      detail:
        'Hunger-tagged cries cluster. Try proactive feeds 15 minutes before the usual fuss window.',
    });
  }
  if (!actions.length) {
    actions.push({
      priority: 'low',
      title: 'Maintain baseline',
      detail: 'Signals look stable. Keep logging alerts for one more week to tighten seasonal baselines.',
    });
  }
  return actions;
}

export function exploratoryAgentReply(question, ctx) {
  const q = String(question || '').trim().toLowerCase();
  const { events, sensors, topReason, alerts24, avgHum, avgTmp } = ctx;
  if (!q) {
    return 'Ask about humidity, temperature, cry counts, top reasons, or what to do next — I use merged MongoDB readings plus the infant cry & nutrition CSV on this device.';
  }
  if (/help|^what can|suggest|recommend|should i/.test(q)) {
    return buildDecisionSupport({ sensors, events })
      .map((a) => `• ${a.title}: ${a.detail}`)
      .join('\n');
  }
  if (/humid/.test(q)) {
    return avgHum != null
      ? `Blended average humidity is about ${avgHum.toFixed(1)}% across the visible series. ${
          avgHum > 70 ? 'That is elevated — prioritize airflow in the sleep block.' : 'That sits in a typical comfort band.'
        }`
      : 'No humidity samples in the merged window yet.';
  }
  if (/temp|warm|cool|heat/.test(q)) {
    return avgTmp != null
      ? `Mean temperature in the merged history is near ${avgTmp.toFixed(1)}°C. Pair with humidity when judging heat stress.`
      : 'No temperature samples in the merged window yet.';
  }
  if (/how many|count|alert|cry/.test(q)) {
    return `Roughly ${events?.length ?? 0} merged cry-style events in the loaded window, with ${alerts24} in the last 24 hours. Top interpreted reason: ${topReason || 'n/a'}.`;
  }
  if (/reason|pattern|hungry|tired|discomfort/.test(q)) {
    const hist = reasonHistogram(events);
    if (!hist.length) return 'No labeled reasons in the merged set yet.';
    return `Reason mix: ${hist.map((h) => `${h.reason} (${h.count})`).join(', ')}.`;
  }
  if (/summarize|critical|mild|severity/.test(q)) {
    const c = (events || []).filter((e) => e.severity === 'critical').length;
    const m = (events || []).filter((e) => e.severity === 'mild').length;
    return `Severity split in the merged window: ${c} critical, ${m} mild. Open Analytics filters to isolate each band.`;
  }
  if (/mongo|database|live|real|csv|cohort/.test(q)) {
    return 'Live rows from your CryGuard API (MongoDB) are merged with infant_cry_nutrition_data.csv — daily cry counts and feeding fields are expanded into alerts and aligned to the current week for charting.';
  }
  return `Try: “What’s average humidity?”, “How many cries last 24h?”, or “What should I do?” — Top reason right now: ${topReason || 'unknown'}.`;
}

export function buildAgentContext(mergedSensors, mergedEvents, mergedNotifications) {
  const hist = reasonHistogramFromCryLabels(mergedNotifications ?? []);
  return {
    events: mergedEvents,
    sensors: mergedSensors,
    topReason: hist[0]?.reason,
    alerts24: cryAlertsLast24h(mergedEvents),
    avgHum: avgHumidity(mergedSensors),
    avgTmp: avgTemp(mergedSensors),
  };
}

/**
 * One-line detail for activity timeline (avoids repeating wall-clock + cohort diary date).
 */
export function formatCryTimelineDetail(message) {
  const raw = String(message || '').trim();
  if (!raw) return '';

  const cohort = /^Cohort log\s+(\S+)\s*—\s*cry\s+(\d+)\/(\d+)\s+on\s+([\d?-]+)\.\s*/i.exec(raw);
  if (cohort) {
    const babyId = cohort[1];
    const cryIdx = cohort[2];
    const cryTotal = cohort[3];
    const diary = cohort[4];
    let tail = raw.slice(cohort[0].length).trim();
    tail = tail.split(/\.\s*Nutrition signal:/i)[0].trim();
    tail = tail.replace(/^Intensity\s+/i, 'Intensity: ').replace(/\s+/g, ' ').trim();
    const compact = `Cohort · ${babyId} · cry ${cryIdx}/${cryTotal} · diary ${diary}${tail ? ` · ${tail}` : ''}`;
    return compact.length > 160 ? `${compact.slice(0, 157)}…` : compact;
  }

  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 110) return collapsed;
  return `${collapsed.slice(0, 107)}…`;
}

/** Timeline rows: cries + motion transitions from sensor series */
export function buildActivityTimelineItems(sensors, notifications) {
  const items = [];
  const sns = [...(sensors || [])].filter((s) => s.timestamp != null).sort((a, b) => b.timestamp - a.timestamp);
  (notifications || []).forEach((n, idx) => {
    const slug = normalizeCryLabel(n.cry_label ?? n.label) ?? inferReasonFromMessage(n.message);
    const titleRow = slug ? LENS_GRID_ORDER.find(([s]) => s === slug) : null;
    const title = titleRow ? titleRow[1] : 'Alert';
    items.push({
      id: `cry-${String(n.timestamp)}-${idx}`,
      title,
      timeLabel: formatEventTime(n.timestamp),
      detail: formatCryTimelineDetail(n.message),
      kind: 'cry',
      timestamp: n.timestamp,
    });
  });
  let prevMotion = null;
  for (const s of sns.slice(0, 24)) {
    if (prevMotion === null) prevMotion = s.motion;
    if (prevMotion !== s.motion) {
      items.push({
        id: `mot-${s.timestamp}`,
        title: s.motion ? 'Motion picked up' : 'Settled — low motion',
        timeLabel: formatEventTime(s.timestamp),
        detail: '',
        kind: 'motion',
        timestamp: s.timestamp,
      });
      prevMotion = s.motion;
    }
  }
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, 12);
}

export function computeAnalyticsSummary(events, sensors, notifications) {
  const hist =
    notifications != null ? reasonHistogramFromCryLabels(notifications) : reasonHistogram(events);
  const top = hist[0]?.reason || '—';
  const topCount = hist[0]?.count ?? 0;
  const totalLabeled = hist.reduce((s, h) => s + h.count, 0) || 1;
  const topShare = Math.round((topCount / totalLabeled) * 100);
  const alerts24 = cryAlertsLast24h(events);
  const prev24 = (events || []).filter((e) => {
    const t = e.timestamp;
    return t < nowSec() - 86400 && t >= nowSec() - 172800;
  }).length;
  const delta = prev24 > 0 ? Math.round(((alerts24 - prev24) / prev24) * 100) : alerts24 > 0 ? 100 : 0;
  const avgHum = avgHumidity(sensors);
  return {
    topReason: top,
    topTrend: `Shows up in about ${topShare}% of labeled alerts in this view`,
    alertsToday: alerts24,
    alertsTrend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    alertsTrendLabel:
      prev24 === 0 && alerts24 === 0
        ? 'Nothing to compare to yesterday yet'
        : delta === 0
          ? 'About the same as the day before'
          : `${Math.abs(delta)}% ${delta > 0 ? 'more' : 'fewer'} than the day before`,
    avgResponseLabel: avgHum != null && avgHum > 70 ? 'Room may feel muggy' : 'Humidity looks typical',
    avgResponseDetail:
      avgHum != null
        ? `Average humidity is about ${avgHum.toFixed(0)}% across recent readings`
        : 'We need more humidity readings from the sensor',
  };
}

export function hourlyCryBuckets(events, hours = 48) {
  const t0 = nowSec() - hours * 3600;
  const end = nowSec();
  const bins = Array.from({ length: hours }, (_, i) => ({
    label: `${i}h`,
    count: 0,
    tStart: t0 + i * 3600,
  }));
  for (const e of events || []) {
    if (e.timestamp < t0 || e.timestamp > end) continue;
    const idx = Math.min(hours - 1, Math.max(0, Math.floor((e.timestamp - t0) / 3600)));
    bins[idx].count += 1;
  }
  return bins;
}
