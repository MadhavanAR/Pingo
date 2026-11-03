'use strict';

const { STATS_DAYS } = require('./config');

/**
 * Per-day counts of reminders answered with Done or Snooze, kept for the Home
 * view. Shape: { "2026-11-03": { done: { <id>: 2 }, snoozed: { <id>: 1 } } }.
 * Only the last STATS_DAYS days are kept; nothing leaves the machine.
 */

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const sum = (counts = {}) => Object.values(counts).reduce((a, b) => a + b, 0);

/** Return a new stats object with one more `kind` for reminder `id` on `date`. */
function recordEvent(stats, id, kind, date = new Date()) {
  const valid = stats && typeof stats === 'object' && !Array.isArray(stats) ? stats : {};
  const key = dayKey(date);
  const day = valid[key] ?? { done: {}, snoozed: {} };
  const bucket = { ...(day[kind] ?? {}) };
  bucket[id] = (Number(bucket[id]) || 0) + 1;
  const next = { ...valid, [key]: { ...day, [kind]: bucket } };
  const keep = Object.keys(next).sort().slice(-STATS_DAYS);
  return Object.fromEntries(keep.map((k) => [k, next[k]]));
}

/**
 * Today's totals, per-reminder counts for today, and the last seven days
 * (oldest first) for the week chart.
 */
function summarize(stats, date = new Date()) {
  const valid = stats && typeof stats === 'object' ? stats : {};
  const today = valid[dayKey(date)] ?? { done: {}, snoozed: {} };
  const week = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
    const day = valid[dayKey(d)];
    week.push({
      date: dayKey(d),
      weekday: d.getDay(),
      done: sum(day?.done),
      snoozed: sum(day?.snoozed),
    });
  }
  return {
    today: { done: sum(today.done), snoozed: sum(today.snoozed) },
    doneToday: { ...today.done },
    week,
  };
}

module.exports = { dayKey, recordEvent, summarize };
