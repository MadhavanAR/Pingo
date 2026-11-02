'use strict';

/**
 * Everything a user can change from the app, with defaults and validation.
 * All writes go through `normalizeSettings`, so values from the renderer or a
 * hand-edited config file can never put the app into an invalid state.
 */

const LIMITS = Object.freeze({
  NAME_MAX_LENGTH: 24,
  MESSAGE_MAX_LENGTH: 120,
  MAX_INTERVAL_MIN: 720, // 12 hours
  MAX_SNOOZE_MIN: 120,
});

const DEFAULTS = Object.freeze({
  name: '',
  message: '', // empty means the built-in drink-water reminders
  intervalMin: 45,
  snoozeMin: 10,
  // Reminders appear from start (inclusive) to end (exclusive), in local time.
  // start === end means any time of day.
  activeStartHour: 10,
  activeEndHour: 23,
});

/** Strip control characters, collapse whitespace, trim and cap the length. */
function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ') // eslint-disable-line no-control-regex
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function wholeNumber(value, { min, max, fallback }) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

const FIELDS = Object.freeze({
  name: (v) => cleanText(v, LIMITS.NAME_MAX_LENGTH),
  message: (v) => cleanText(v, LIMITS.MESSAGE_MAX_LENGTH),
  intervalMin: (v) =>
    wholeNumber(v, { min: 1, max: LIMITS.MAX_INTERVAL_MIN, fallback: DEFAULTS.intervalMin }),
  snoozeMin: (v) =>
    wholeNumber(v, { min: 1, max: LIMITS.MAX_SNOOZE_MIN, fallback: DEFAULTS.snoozeMin }),
  activeStartHour: (v) => wholeNumber(v, { min: 0, max: 23, fallback: DEFAULTS.activeStartHour }),
  activeEndHour: (v) => wholeNumber(v, { min: 0, max: 23, fallback: DEFAULTS.activeEndHour }),
});

/**
 * Merge `patch` over `base`, validating every known field and dropping
 * unknown ones.
 */
function normalizeSettings(patch = {}, base = DEFAULTS) {
  const out = {};
  for (const [key, normalize] of Object.entries(FIELDS)) {
    const has = patch !== null && typeof patch === 'object' && Object.hasOwn(patch, key);
    out[key] = has ? normalize(patch[key]) : base[key];
  }
  return out;
}

/** Read settings from the store, filling gaps with defaults. */
function readSettings(store) {
  const saved = {};
  for (const key of Object.keys(FIELDS)) {
    const value = store.get(key);
    if (value !== undefined) saved[key] = value;
  }
  return normalizeSettings(saved);
}

module.exports = { DEFAULTS, LIMITS, normalizeSettings, readSettings };
