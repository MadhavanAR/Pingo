'use strict';

/**
 * App-wide settings a user can change: who they are and how Pingo looks.
 * Each reminder's own schedule lives in `reminders.js`. All writes go through
 * `normalizeSettings`, so values from the renderer or a hand-edited config
 * file can never put the app into an invalid state.
 */

const LIMITS = Object.freeze({
  NAME_MAX_LENGTH: 24,
  MIN_SIZE: 80,
  MAX_SIZE: 140,
  MAX_AUTO_HIDE_MIN: 30,
});

const CHOICES = Object.freeze({
  theme: Object.freeze(['system', 'light', 'dark']),
  bubbleStyle: Object.freeze(['modern', 'pixel']),
  accent: Object.freeze(['teal', 'ocean', 'grass', 'sun', 'coral', 'ink']),
  side: Object.freeze(['right', 'left']),
  screen: Object.freeze(['primary', 'cursor']),
  sound: Object.freeze(['none', 'chime', 'pop', 'bell']),
});

const DEFAULTS = Object.freeze({
  name: '',
  theme: 'system',
  bubbleStyle: 'modern',
  accent: 'teal',
  size: 100, // percent: scales the character and its bubble together
  side: 'right',
  screen: 'primary',
  sound: 'none',
  autoHideMin: 0, // 0 means stay until answered; otherwise snooze itself after this long
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

const oneOf = (key) => (v) => (CHOICES[key].includes(v) ? v : DEFAULTS[key]);

const FIELDS = Object.freeze({
  name: (v) => cleanText(v, LIMITS.NAME_MAX_LENGTH),
  theme: oneOf('theme'),
  bubbleStyle: oneOf('bubbleStyle'),
  accent: oneOf('accent'),
  size: (v) =>
    wholeNumber(v, { min: LIMITS.MIN_SIZE, max: LIMITS.MAX_SIZE, fallback: DEFAULTS.size }),
  side: oneOf('side'),
  screen: oneOf('screen'),
  sound: oneOf('sound'),
  autoHideMin: (v) =>
    wholeNumber(v, { min: 0, max: LIMITS.MAX_AUTO_HIDE_MIN, fallback: DEFAULTS.autoHideMin }),
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

module.exports = {
  CHOICES,
  DEFAULTS,
  LIMITS,
  cleanText,
  wholeNumber,
  normalizeSettings,
  readSettings,
};
