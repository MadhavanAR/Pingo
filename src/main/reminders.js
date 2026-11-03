'use strict';

const crypto = require('node:crypto');
const { MINUTE_MS } = require('./config');
const { cleanText, wholeNumber } = require('./settings');

/**
 * Reminders: what to remind about, and when. A user can keep as many as they
 * like (up to LIMITS.MAX_REMINDERS), each with its own schedule, days, active
 * hours, snooze length and character.
 *
 * Times of day are minutes since local midnight; days are 0 (Sunday) to 6.
 */

const LIMITS = Object.freeze({
  MAX_REMINDERS: 50,
  MAX_TIMES: 12,
  MESSAGE_MAX_LENGTH: 120,
  MAX_INTERVAL_MIN: 720, // 12 hours
  MAX_SNOOZE_MIN: 120,
});

/** Built-in kinds. `pose` is the sprite shown while celebrating. */
const TYPES = Object.freeze({
  water: Object.freeze({ label: 'Drink water', pose: 'drink' }),
  stretch: Object.freeze({ label: 'Stretch', pose: 'stretch' }),
  eyes: Object.freeze({ label: 'Rest your eyes', pose: 'rest' }),
  posture: Object.freeze({ label: 'Sit up straight', pose: 'point' }),
  medicine: Object.freeze({ label: 'Take your medicine', pose: 'point' }),
  custom: Object.freeze({ label: 'Reminder', pose: 'point' }),
});

const ALL_DAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

const DEFAULT_REMINDER = Object.freeze({
  type: 'water',
  message: '', // empty means the type's built-in, varied copy
  enabled: true,
  mode: 'interval', // 'interval' (every N minutes) or 'times' (at set times of day)
  everyMin: 45,
  times: Object.freeze(['09:00']),
  days: ALL_DAYS,
  start: 10 * 60, // active hours for interval reminders; start === end means all day
  end: 23 * 60,
  snoozeMin: 10,
  avatar: null, // null means the default character
});

const newId = () => crypto.randomBytes(6).toString('hex');

const isId = (v) => typeof v === 'string' && /^[a-z0-9]{1,24}$/.test(v);

function minuteOfDay(value, fallback) {
  if (typeof value === 'string') {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h < 24 && min < 60 ? h * 60 + min : fallback;
  }
  return wholeNumber(value, { min: 0, max: 1439, fallback });
}

const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function normalizeTimes(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const minutes = new Set();
  for (const t of value) {
    const m = minuteOfDay(t, null);
    if (m !== null) minutes.add(m);
  }
  const sorted = [...minutes]
    .sort((a, b) => a - b)
    .slice(0, LIMITS.MAX_TIMES)
    .map(hhmm);
  return sorted.length ? sorted : [...fallback];
}

function normalizeDays(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const days = [
    ...new Set(value.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ];
  // A reminder with no days would never fire; treat "none" as a mistake.
  return days.length ? days.sort((a, b) => a - b) : [...ALL_DAYS];
}

const FIELDS = Object.freeze({
  type: (v) => (Object.hasOwn(TYPES, v) ? v : 'custom'),
  message: (v) => cleanText(v, LIMITS.MESSAGE_MAX_LENGTH),
  enabled: (v) => v !== false,
  mode: (v) => (v === 'times' ? 'times' : 'interval'),
  everyMin: (v) =>
    wholeNumber(v, { min: 1, max: LIMITS.MAX_INTERVAL_MIN, fallback: DEFAULT_REMINDER.everyMin }),
  times: (v) => normalizeTimes(v, DEFAULT_REMINDER.times),
  days: (v) => normalizeDays(v, ALL_DAYS),
  start: (v) => minuteOfDay(v, DEFAULT_REMINDER.start),
  end: (v) => minuteOfDay(v, DEFAULT_REMINDER.end),
  snoozeMin: (v) =>
    wholeNumber(v, { min: 1, max: LIMITS.MAX_SNOOZE_MIN, fallback: DEFAULT_REMINDER.snoozeMin }),
  avatar: (v) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null),
});

/** Merge `patch` over `base` (another reminder), validating every field. */
function normalizeReminder(patch, base = DEFAULT_REMINDER) {
  const src = patch !== null && typeof patch === 'object' ? patch : {};
  const out = { id: isId(src.id) ? src.id : isId(base.id) ? base.id : newId() };
  for (const [key, normalize] of Object.entries(FIELDS)) {
    out[key] = Object.hasOwn(src, key) ? normalize(src[key]) : normalize(base[key]);
  }
  return out;
}

/** Validate a stored list: drop junk and duplicate ids, cap the count. */
function normalizeReminders(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (out.length >= LIMITS.MAX_REMINDERS) break;
    const r = normalizeReminder(item);
    if (seen.has(r.id)) r.id = newId();
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/** The single reminder older versions stored as flat settings. */
function legacyReminder(get) {
  const message = cleanText(get('message'), LIMITS.MESSAGE_MAX_LENGTH);
  const startHour = get('activeStartHour');
  const endHour = get('activeEndHour');
  return normalizeReminder({
    type: message ? 'custom' : 'water',
    message,
    everyMin: get('intervalMin'),
    snoozeMin: get('snoozeMin'),
    start: Number.isFinite(startHour) ? startHour * 60 : undefined,
    end: Number.isFinite(endHour) ? endHour * 60 : undefined,
  });
}

// --- When is it due? -------------------------------------------------------

const localMinute = (date) => date.getHours() * 60 + date.getMinutes();

function inWindow({ start, end }, minute) {
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Whether this reminder may appear at `date` (right day, inside its hours). */
function isAllowedAt(reminder, date) {
  if (!reminder.days.includes(date.getDay())) return false;
  return reminder.mode === 'times' || inWindow(reminder, localMinute(date));
}

/** First whole minute at or after `fromMs` when the reminder may appear. */
function nextAllowedFrom(reminder, fromMs) {
  let t = Math.ceil(fromMs / MINUTE_MS) * MINUTE_MS;
  for (let i = 0; i <= 8 * 1440; i++, t += MINUTE_MS) {
    if (isAllowedAt(reminder, new Date(t))) return t;
  }
  return null;
}

function nextSetTime(reminder, fromMs) {
  const from = new Date(fromMs);
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    if (!reminder.days.includes(day.getDay())) continue;
    for (const time of reminder.times) {
      const minutes = minuteOfDay(time, 0);
      const at = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        Math.floor(minutes / 60),
        minutes % 60,
      ).getTime();
      if (at > fromMs) return at;
    }
  }
  return null;
}

/**
 * When the reminder should next appear after `fromMs` (ms), or null if it is
 * switched off. Interval reminders that would land outside their hours move
 * to the next moment the hours open.
 */
function nextDue(reminder, fromMs) {
  if (!reminder.enabled) return null;
  if (reminder.mode === 'times') return nextSetTime(reminder, fromMs);
  const candidate = fromMs + reminder.everyMin * MINUTE_MS;
  return isAllowedAt(reminder, new Date(candidate))
    ? candidate
    : nextAllowedFrom(reminder, candidate);
}

/** The fields that decide timing; when these change the countdown restarts. */
const scheduleKey = (r) =>
  JSON.stringify([r.enabled, r.mode, r.everyMin, r.times, r.days, r.start, r.end]);

module.exports = {
  LIMITS,
  TYPES,
  DEFAULT_REMINDER,
  newId,
  hhmm,
  normalizeReminder,
  normalizeReminders,
  legacyReminder,
  isAllowedAt,
  nextAllowedFrom,
  nextDue,
  scheduleKey,
};
