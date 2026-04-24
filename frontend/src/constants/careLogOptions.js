/** Aligned with infant_cry_nutrition_data.csv value sets */

export const CRY_INTENSITY = ['low', 'medium', 'high'];
export const MOTION_LEVEL = ['low', 'normal', 'high'];
export const FEEDING_TYPE = ['formula', 'breastmilk', 'mixed', 'solids'];
export const FEEDING_FREQUENCY = ['low', 'normal', 'high'];
export const WATER_INTAKE = ['low', 'adequate', 'high'];
export const MEAL_TIMING = ['regular', 'irregular'];
export const NUTRITION_LEVEL = ['low', 'balanced', 'high'];
export const PEAK_CRY = ['morning', 'afternoon', 'night'];

export function dayTypeForDateString(yyyyMmDd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return 'weekday';
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  return wd === 0 || wd === 6 ? 'weekend' : 'weekday';
}

export function todayLocalIso() {
  const t = new Date();
  const y = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, '0');
  const da = String(t.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** 8:00 PM ≤ t < 10:00 PM in browser local clock */
export function isEveningWindowLocal() {
  const t = new Date();
  const mins = t.getHours() * 60 + t.getMinutes();
  return mins >= 20 * 60 && mins < 22 * 60;
}

export function clientIanaTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
