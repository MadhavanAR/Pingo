'use strict';

const { SCHEDULE, NAME_MAX_LENGTH } = require('./config');

/** Clamp a requested interval to a whole number of minutes in [1, MAX]. */
function normalizeInterval(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return SCHEDULE.DEFAULT_INTERVAL_MIN;
  return Math.min(n, SCHEDULE.MAX_INTERVAL_MIN);
}

/** Trim, strip control characters and cap the length of a display name. */
function normalizeName(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '') // eslint-disable-line no-control-regex
    .trim()
    .slice(0, NAME_MAX_LENGTH);
}

/** Decode a base64 `data:image/...` URL; returns null for anything else. */
function dataUrlToBuffer(dataUrl, maxBytes = Infinity) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:image\/[\w+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  // Reject before decoding: base64 inflates size by 4/3.
  if ((match[1].length * 3) / 4 > maxBytes) return null;
  const buf = Buffer.from(match[1], 'base64');
  return buf.length > 0 && buf.length <= maxBytes ? buf : null;
}

module.exports = { normalizeInterval, normalizeName, dataUrlToBuffer };
