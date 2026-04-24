/**
 * Infer `estimated_nutrition_level` (low | balanced | high) from parent-entered
 * feeding fields by matching against infant_cry_nutrition_data.csv cohort rows.
 */
import nutritionCsvRaw from '../data/infant_cry_nutrition_data.csv?raw';
import { parseNutritionCsvRows } from './analyticsData';

let _cohortCache = null;

function cohortRows() {
  if (!_cohortCache) {
    _cohortCache = parseNutritionCsvRows(nutritionCsvRaw);
  }
  return _cohortCache;
}

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function eq(a, b) {
  return norm(a) === norm(b);
}

function mainFoodTokens(s) {
  return new Set(
    norm(s)
      .split(/[\s,;/+|]+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean),
  );
}

/** Jaccard similarity on token sets (e.g. "milk, rice" vs "milk"). */
function mainFoodJaccard(parentMain, rowMain) {
  const A = mainFoodTokens(parentMain);
  const B = mainFoodTokens(rowMain);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function scoreRow(row, p) {
  let s = 0;
  if (eq(row.feeding_type, p.feeding_type)) s += 2.25;
  if (eq(row.feeding_frequency, p.feeding_frequency)) s += 1.6;
  if (eq(row.water_intake, p.water_intake)) s += 1.6;
  if (eq(row.meal_timing_pattern, p.meal_timing_pattern)) s += 1.6;
  s += mainFoodJaccard(p.main_food_types, row.main_food_types) * 2.8;
  return s;
}

function modeNutrition(rows) {
  const counts = { low: 0, balanced: 0, high: 0 };
  for (const r of rows) {
    const v = norm(r.estimated_nutrition_level);
    if (v === 'low') counts.low += 1;
    else if (v === 'high') counts.high += 1;
    else if (v === 'balanced') counts.balanced += 1;
  }
  const entries = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const order = { balanced: 0, high: 1, low: 2 };
    return order[a[0]] - order[b[0]];
  });
  if (entries[0][1] === 0) return null;
  return entries[0][0];
}

function narrowPool(allRows, predicate) {
  return allRows.filter(predicate);
}

/**
 * @param {{ feeding_type: string, main_food_types: string, feeding_frequency: string, water_intake: string, meal_timing_pattern: string }} input
 * @returns {'low'|'balanced'|'high'|null}
 */
export function inferEstimatedNutritionLevel(input) {
  const p = {
    feeding_type: input.feeding_type,
    main_food_types: input.main_food_types,
    feeding_frequency: input.feeding_frequency,
    water_intake: input.water_intake,
    meal_timing_pattern: input.meal_timing_pattern,
  };
  if (
    !norm(p.feeding_type) ||
    !norm(p.main_food_types) ||
    !norm(p.feeding_frequency) ||
    !norm(p.water_intake) ||
    !norm(p.meal_timing_pattern)
  ) {
    return null;
  }

  const all = cohortRows();
  if (!all.length) return null;

  const scored = all.map((r) => ({ r, s: scoreRow(r, p) })).sort((a, b) => b.s - a.s);
  const best = scored[0]?.s ?? 0;

  const takeBand = (delta) => scored.filter((x) => x.s >= best - delta && x.s >= 2.5).map((x) => x.r);
  let pool = takeBand(0.35);
  if (pool.length < 8) pool = takeBand(0.9);
  if (pool.length < 5) pool = takeBand(1.4);
  if (pool.length < 3 && best >= 3) pool = scored.slice(0, 40).map((x) => x.r);

  let label = pool.length ? modeNutrition(pool) : null;

  if (!label) {
    const r2 = narrowPool(
      all,
      (r) =>
        eq(r.feeding_type, p.feeding_type) &&
        eq(r.meal_timing_pattern, p.meal_timing_pattern) &&
        eq(r.water_intake, p.water_intake),
    );
    label = r2.length ? modeNutrition(r2) : null;
  }
  if (!label) {
    const r3 = narrowPool(all, (r) => eq(r.feeding_type, p.feeding_type) && eq(r.meal_timing_pattern, p.meal_timing_pattern));
    label = r3.length ? modeNutrition(r3) : null;
  }
  if (!label) {
    const r4 = narrowPool(all, (r) => eq(r.feeding_type, p.feeding_type));
    label = r4.length ? modeNutrition(r4) : null;
  }

  return label || 'balanced';
}
