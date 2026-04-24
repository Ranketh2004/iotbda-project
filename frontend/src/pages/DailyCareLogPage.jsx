import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, RefreshCw, Save } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import DashboardFooter from '../components/DashboardFooter';
import {
  CRY_INTENSITY,
  MOTION_LEVEL,
  FEEDING_TYPE,
  FEEDING_FREQUENCY,
  WATER_INTAKE,
  MEAL_TIMING,
  NUTRITION_LEVEL,
  PEAK_CRY,
  dayTypeForDateString,
  todayLocalIso,
  isEveningWindowLocal,
  clientIanaTimezone,
} from '../constants/careLogOptions';
import { fetchCareLogToday, fetchCareLogWindow, fetchCareLogSuggestions, submitCareLog } from '../services/api';
import { inferEstimatedNutritionLevel } from '../utils/nutritionInference';

function mergeSensorAutofill(form, sug) {
  if (!sug) return form;
  const next = { ...form };
  const keys = ['cry_frequency', 'cry_intensity_avg', 'motion_activity_level', 'time_of_day_peak_cry'];
  for (const k of keys) {
    const cur = next[k];
    const empty = cur === '' || cur == null;
    if (empty && sug[k] != null && sug[k] !== '') {
      next[k] = String(sug[k]);
    }
  }
  return next;
}

const initialForm = (entryDate, dayType) => ({
  entry_date: entryDate,
  age_days: '',
  cry_frequency: '',
  cry_intensity_avg: '',
  motion_activity_level: '',
  feeding_type: '',
  main_food_types: '',
  feeding_frequency: '',
  water_intake: '',
  meal_timing_pattern: '',
  estimated_nutrition_level: '',
  time_of_day_peak_cry: '',
  day_type: dayType,
});

function labelize(slug) {
  return String(slug || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function validate(form) {
  const e = {};
  const age = parseInt(form.age_days, 10);
  if (Number.isNaN(age) || age < 0 || age > 1200) e.age_days = 'Enter age in days (0–1200).';
  const cf = parseInt(form.cry_frequency, 10);
  if (Number.isNaN(cf) || cf < 0 || cf > 60) e.cry_frequency = 'Cry count must be 0–60.';
  if (!CRY_INTENSITY.includes(form.cry_intensity_avg)) e.cry_intensity_avg = 'Choose intensity.';
  if (!MOTION_LEVEL.includes(form.motion_activity_level)) e.motion_activity_level = 'Choose motion level.';
  if (!FEEDING_TYPE.includes(form.feeding_type)) e.feeding_type = 'Choose feeding type.';
  if (!form.main_food_types || form.main_food_types.trim().length < 1) e.main_food_types = 'Describe main foods (e.g. milk, rice).';
  if (form.main_food_types && form.main_food_types.length > 120) e.main_food_types = 'Max 120 characters.';
  if (!FEEDING_FREQUENCY.includes(form.feeding_frequency)) e.feeding_frequency = 'Choose feeding frequency.';
  if (!WATER_INTAKE.includes(form.water_intake)) e.water_intake = 'Choose water intake.';
  if (!MEAL_TIMING.includes(form.meal_timing_pattern)) e.meal_timing_pattern = 'Choose meal timing.';
  if (!NUTRITION_LEVEL.includes(form.estimated_nutrition_level))
    e.estimated_nutrition_level = 'Nutrition level is required (it auto-fills when all parent feeding fields are set).';
  if (!PEAK_CRY.includes(form.time_of_day_peak_cry)) e.time_of_day_peak_cry = 'Choose peak cry time.';
  const expectedDt = dayTypeForDateString(form.entry_date);
  if (form.day_type !== expectedDt) e.day_type = `Must be ${expectedDt} for the selected date.`;
  return e;
}

export default function DailyCareLogPage() {
  const navigate = useNavigate();
  const tz = useMemo(() => clientIanaTimezone(), []);
  /** True when local time is in the recommended 8–10 PM window (informational). */
  const [inPreferredWindow, setInPreferredWindow] = useState(false);
  const [serverWindow, setServerWindow] = useState(null);
  const [form, setForm] = useState(() => initialForm(todayLocalIso(), dayTypeForDateString(todayLocalIso())));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insightFoot, setInsightFoot] = useState('');
  /** When true, do not overwrite `estimated_nutrition_level` from CSV inference (e.g. saved log or manual pick). */
  const nutritionUserTouchedRef = useRef(false);

  const refreshWindow = useCallback(async () => {
    const localOk = isEveningWindowLocal();
    setInPreferredWindow(localOk);
    try {
      const token = localStorage.getItem('cryguard_token');
      if (!token) {
        setServerWindow(null);
        return;
      }
      const w = await fetchCareLogWindow(tz);
      setServerWindow(w);
      const pref = w.in_preferred_window ?? w.allowed;
      if (typeof pref === 'boolean') setInPreferredWindow(pref);
    } catch {
      setServerWindow(null);
      setInPreferredWindow(localOk);
    }
  }, [tz]);

  const loadToday = useCallback(async () => {
    if (!localStorage.getItem('cryguard_token')) {
      navigate('/login', { replace: true });
      return;
    }
    setLoading(true);
    try {
      const todayRes = await fetchCareLogToday(tz);
      const { entry_date: ed, log } = todayRes;
      let sug = null;
      try {
        sug = await fetchCareLogSuggestions(tz, ed);
      } catch {
        /* optional */
      }
      const dayType = dayTypeForDateString(ed);
      let base;
      if (log) {
        base = {
          entry_date: log.entry_date || ed,
          age_days: String(log.age_days ?? ''),
          cry_frequency: String(log.cry_frequency ?? ''),
          cry_intensity_avg: log.cry_intensity_avg || '',
          motion_activity_level: log.motion_activity_level || '',
          feeding_type: log.feeding_type || '',
          main_food_types: log.main_food_types || '',
          feeding_frequency: log.feeding_frequency || '',
          water_intake: log.water_intake || '',
          meal_timing_pattern: log.meal_timing_pattern || '',
          estimated_nutrition_level: log.estimated_nutrition_level || '',
          time_of_day_peak_cry: log.time_of_day_peak_cry || '',
          day_type: log.day_type || dayType,
        };
      } else {
        base = initialForm(ed, dayType);
      }
      nutritionUserTouchedRef.current = Boolean(log?.estimated_nutrition_level);
      setForm(mergeSensorAutofill(base, sug));
      if (sug?.sources) {
        setInsightFoot(
          `Autofill from MongoDB: ${sug.sources.sensor_samples ?? 0} sensor readings, ${sug.sources.cry_alerts ?? 0} cry alerts for ${ed}.`,
        );
      } else {
        setInsightFoot('');
      }
    } catch (e) {
      const today = todayLocalIso();
      setForm(initialForm(today, dayTypeForDateString(today)));
      setInsightFoot('');
      setStatus(e.message || 'Could not load saved log.');
    } finally {
      setLoading(false);
    }
  }, [navigate, tz]);

  const refreshFromSensors = useCallback(async () => {
    setStatus('');
    try {
      const sug = await fetchCareLogSuggestions(tz, form.entry_date);
      setForm((f) => ({
        ...f,
        cry_frequency: String(sug.cry_frequency ?? ''),
        time_of_day_peak_cry: sug.time_of_day_peak_cry || f.time_of_day_peak_cry,
        motion_activity_level: sug.motion_activity_level || f.motion_activity_level,
        cry_intensity_avg: sug.cry_intensity_avg || f.cry_intensity_avg,
      }));
      if (sug?.sources) {
        setInsightFoot(
          `Updated from MongoDB: ${sug.sources.sensor_samples ?? 0} sensor readings, ${sug.sources.cry_alerts ?? 0} cry alerts.`,
        );
      }
      setStatus('Cry / motion fields refreshed from sensors.');
    } catch (err) {
      setStatus(err.message || 'Could not refresh from sensors.');
    }
  }, [tz, form.entry_date]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    refreshWindow();
    const id = setInterval(() => refreshWindow(), 30000);
    return () => clearInterval(id);
  }, [refreshWindow]);

  useEffect(() => {
    const dayType = dayTypeForDateString(form.entry_date);
    if (form.day_type !== dayType) {
      setForm((f) => ({ ...f, day_type: dayType }));
    }
  }, [form.entry_date, form.day_type]);

  useEffect(() => {
    if (loading) return;

    const complete =
      FEEDING_TYPE.includes(form.feeding_type) &&
      FEEDING_FREQUENCY.includes(form.feeding_frequency) &&
      WATER_INTAKE.includes(form.water_intake) &&
      MEAL_TIMING.includes(form.meal_timing_pattern) &&
      String(form.main_food_types || '').trim().length >= 1;

    if (!complete) {
      setForm((f) => (f.estimated_nutrition_level !== '' ? { ...f, estimated_nutrition_level: '' } : f));
      return;
    }

    if (nutritionUserTouchedRef.current) return;

    const inferred = inferEstimatedNutritionLevel({
      feeding_type: form.feeding_type,
      main_food_types: form.main_food_types,
      feeding_frequency: form.feeding_frequency,
      water_intake: form.water_intake,
      meal_timing_pattern: form.meal_timing_pattern,
    });
    if (!inferred || !NUTRITION_LEVEL.includes(inferred)) return;

    setForm((f) => (f.estimated_nutrition_level === inferred ? f : { ...f, estimated_nutrition_level: inferred }));
  }, [
    loading,
    form.feeding_type,
    form.main_food_types,
    form.feeding_frequency,
    form.water_intake,
    form.meal_timing_pattern,
  ]);

  const canSubmit = !loading && !saving;

  const onChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const onParentNutritionDriverChange = useCallback((field, value) => {
    nutritionUserTouchedRef.current = false;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  }, []);

  const onNutritionLevelManualChange = useCallback((value) => {
    nutritionUserTouchedRef.current = true;
    setForm((f) => ({ ...f, estimated_nutrition_level: value }));
    setErrors((er) => ({ ...er, estimated_nutrition_level: undefined }));
  }, []);

  const handleSave = async () => {
    setStatus('');
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      const data = await submitCareLog({
        timezone: tz,
        entry_date: form.entry_date,
        age_days: parseInt(form.age_days, 10),
        cry_frequency: parseInt(form.cry_frequency, 10),
        cry_intensity_avg: form.cry_intensity_avg,
        motion_activity_level: form.motion_activity_level,
        feeding_type: form.feeding_type,
        main_food_types: form.main_food_types.trim(),
        feeding_frequency: form.feeding_frequency,
        water_intake: form.water_intake,
        meal_timing_pattern: form.meal_timing_pattern,
        estimated_nutrition_level: form.estimated_nutrition_level,
        time_of_day_peak_cry: form.time_of_day_peak_cry,
        day_type: form.day_type,
      });
      const pref = data?.submitted_in_preferred_window;
      setStatus(
        pref === false
          ? 'Saved to your account. (Logged outside the recommended 8–10 PM window.)'
          : 'Saved to your account.',
      );
      await loadToday();
    } catch (err) {
      setStatus(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, children) => (
    <div className={`care-log-field ${errors[name] ? 'care-log-field--error' : ''}`}>
      <label className="care-log-label" htmlFor={name}>
        {label}
      </label>
      {children}
      {errors[name] ? <p className="care-log-error">{errors[name]}</p> : null}
    </div>
  );

  return (
    <div className="dash-page care-log-page">
      <DashboardHeader />

      <div className="analytics-shell care-log-shell">
        <header className="analytics-page-head care-log-head">
          <div className="care-log-head-icon" aria-hidden>
            <ClipboardList size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="analytics-title">Daily care log</h1>
            <p className="analytics-subtitle care-log-sub">
              Checklist aligned with the infant cry & nutrition dataset. One entry per day per account, stored in
              MongoDB. We recommend filling this between <strong>8:00 PM and 10:00 PM</strong> in your device timezone (
              <code className="care-log-tz">{tz}</code>), you can still save at other times.
            </p>
          </div>
        </header>

        <div
          className={`care-log-window-banner ${inPreferredWindow ? 'care-log-window-banner--preferred' : ''}`}
        >
          <Clock size={20} aria-hidden />
          <div>
            <p className="care-log-window-title">
              {inPreferredWindow ? 'Recommended time (8–10 PM)' : 'Outside recommended window'}
            </p>
            <p className="care-log-window-meta">
              {serverWindow?.local_time
                ? `Reference time (${tz}): ${new Date(serverWindow.local_time).toLocaleString()}. `
                : 'Using your device clock; rechecks every 30s. '}
              {inPreferredWindow
                ? 'You are in the suggested evening slot, great time to log today’s care.'
                : 'You can still save or update today’s log at any time.'}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="care-log-loading">Loading…</p>
        ) : (
          <form
            className="care-log-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {insightFoot ? <p className="care-log-insight-foot">{insightFoot}</p> : null}
            <div className="care-log-grid">
              {field(
                'entry_date',
                'Diary date (today)',
                <input id="entry_date" className="care-log-input care-log-input--readonly" readOnly value={form.entry_date} />,
              )}
              {field(
                'day_type',
                'Day type (auto)',
                <input id="day_type" className="care-log-input care-log-input--readonly" readOnly value={form.day_type} />,
              )}
              <div className="care-log-grid-span">
                <h3 className="care-log-section-title">Cry and motion</h3>
                <p className="care-log-section-sub">
                  Filled from cry alerts and sensor samples. “Refresh from sensors” only updates these four fields.
                </p>
              </div>
              {field(
                'cry_frequency',
                'Cry frequency (count for the day), from cry alerts (you can edit)',
                <input
                  id="cry_frequency"
                  className="care-log-input"
                  inputMode="numeric"
                  value={form.cry_frequency}
                  onChange={(e) => onChange('cry_frequency', e.target.value)}
                  placeholder="0–60"
                />,
              )}
              {field(
                'time_of_day_peak_cry',
                'Time of day, peak cry, from alert timestamps (you can edit)',
                <select
                  id="time_of_day_peak_cry"
                  className="care-log-select"
                  value={form.time_of_day_peak_cry}
                  onChange={(e) => onChange('time_of_day_peak_cry', e.target.value)}
                >
                  <option value="">Select…</option>
                  {PEAK_CRY.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'motion_activity_level',
                'Motion / activity level, from motion sensor samples (you can edit)',
                <select
                  id="motion_activity_level"
                  className="care-log-select"
                  value={form.motion_activity_level}
                  onChange={(e) => onChange('motion_activity_level', e.target.value)}
                >
                  <option value="">Select…</option>
                  {MOTION_LEVEL.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'cry_intensity_avg',
                'Average cry intensity, from alert wording (you can edit)',
                <select
                  id="cry_intensity_avg"
                  className="care-log-select"
                  value={form.cry_intensity_avg}
                  onChange={(e) => onChange('cry_intensity_avg', e.target.value)}
                >
                  <option value="">Select…</option>
                  {CRY_INTENSITY.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              <div className="care-log-grid-span">
                <h3 className="care-log-section-title">Parent / caregiver</h3>
                <p className="care-log-section-sub">
                  Age and feeding details are entered by you. Estimated nutrition is derived from the cohort CSV when
                  all five feeding inputs below are set; you can still override it manually.
                </p>
              </div>
              {field(
                'age_days',
                'Age (days), parent / caregiver',
                <input
                  id="age_days"
                  className="care-log-input"
                  inputMode="numeric"
                  value={form.age_days}
                  onChange={(e) => onChange('age_days', e.target.value)}
                  placeholder="e.g. 120"
                />,
              )}
              {field(
                'feeding_type',
                'Feeding type, parent / caregiver',
                <select
                  id="feeding_type"
                  className="care-log-select"
                  value={form.feeding_type}
                  onChange={(e) => onParentNutritionDriverChange('feeding_type', e.target.value)}
                >
                  <option value="">Select…</option>
                  {FEEDING_TYPE.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'main_food_types',
                'Main food types, parent / caregiver',
                <input
                  id="main_food_types"
                  className="care-log-input"
                  value={form.main_food_types}
                  onChange={(e) => onParentNutritionDriverChange('main_food_types', e.target.value)}
                  placeholder="e.g. milk, rice, fruits"
                  maxLength={120}
                />,
              )}
              {field(
                'feeding_frequency',
                'Feeding frequency, parent / caregiver',
                <select
                  id="feeding_frequency"
                  className="care-log-select"
                  value={form.feeding_frequency}
                  onChange={(e) => onParentNutritionDriverChange('feeding_frequency', e.target.value)}
                >
                  <option value="">Select…</option>
                  {FEEDING_FREQUENCY.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'water_intake',
                'Water intake, parent / caregiver',
                <select
                  id="water_intake"
                  className="care-log-select"
                  value={form.water_intake}
                  onChange={(e) => onParentNutritionDriverChange('water_intake', e.target.value)}
                >
                  <option value="">Select…</option>
                  {WATER_INTAKE.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'meal_timing_pattern',
                'Meal timing pattern, parent / caregiver',
                <select
                  id="meal_timing_pattern"
                  className="care-log-select"
                  value={form.meal_timing_pattern}
                  onChange={(e) => onParentNutritionDriverChange('meal_timing_pattern', e.target.value)}
                >
                  <option value="">Select…</option>
                  {MEAL_TIMING.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'estimated_nutrition_level',
                'Estimated nutrition level, auto from infant_cry_nutrition_data.csv (override if you prefer)',
                <select
                  id="estimated_nutrition_level"
                  className="care-log-select"
                  value={form.estimated_nutrition_level}
                  onChange={(e) => onNutritionLevelManualChange(e.target.value)}
                >
                  <option value="">Select…</option>
                  {NUTRITION_LEVEL.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>,
              )}
            </div>

            {status ? <p className={`care-log-status ${status.includes('Saved') ? 'care-log-status--ok' : ''}`}>{status}</p> : null}

            <div className="care-log-actions">
              <button
                type="button"
                className="care-log-refresh"
                disabled={saving}
                onClick={() => void refreshFromSensors()}
              >
                <RefreshCw size={18} aria-hidden />
                Refresh from sensors
              </button>
              <button
                type="button"
                className="care-log-submit"
                disabled={!canSubmit || saving}
                onClick={() => void handleSave()}
              >
                <Save size={18} aria-hidden />
                {saving ? 'Saving…' : 'Save to database'}
              </button>
            </div>
          </form>
        )}
      </div>

      <DashboardFooter />
    </div>
  );
}
