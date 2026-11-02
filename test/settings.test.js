'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, LIMITS, normalizeSettings, readSettings } = require('../src/main/settings');

test('defaults are returned for an empty patch', () => {
  assert.deepEqual(normalizeSettings({}), DEFAULTS);
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
});

test('a patch only changes the fields it contains', () => {
  const base = normalizeSettings({ name: 'Alex', intervalMin: 30 });
  const next = normalizeSettings({ snoozeMin: 5 }, base);
  assert.equal(next.name, 'Alex');
  assert.equal(next.intervalMin, 30);
  assert.equal(next.snoozeMin, 5);
});

test('text fields are cleaned and length-capped', () => {
  const s = normalizeSettings({
    name: '  Al\nex\u0007  ',
    message: `  Take   your\tmedicine  ${'x'.repeat(500)}`,
  });
  assert.equal(s.name, 'Al ex');
  assert.ok(s.message.startsWith('Take your medicine'));
  assert.equal(s.message.length, LIMITS.MESSAGE_MAX_LENGTH);
  assert.equal(normalizeSettings({ name: 'x'.repeat(100) }).name.length, LIMITS.NAME_MAX_LENGTH);
});

test('numbers are rounded and clamped, and junk falls back to defaults', () => {
  const s = normalizeSettings({
    intervalMin: '44.6',
    snoozeMin: 9999,
    activeStartHour: -3,
    activeEndHour: 30,
  });
  assert.equal(s.intervalMin, 45);
  assert.equal(s.snoozeMin, LIMITS.MAX_SNOOZE_MIN);
  assert.equal(s.activeStartHour, 0);
  assert.equal(s.activeEndHour, 23);
  for (const bad of ['', 'abc', NaN, undefined, null]) {
    assert.equal(normalizeSettings({ intervalMin: bad }).intervalMin, DEFAULTS.intervalMin);
  }
  assert.equal(normalizeSettings({ intervalMin: 0 }).intervalMin, 1);
});

test('unknown fields are dropped', () => {
  assert.equal('isAdmin' in normalizeSettings({ isAdmin: true }), false);
});

test('readSettings validates whatever is on disk', () => {
  const data = { name: 'Priya', intervalMin: 'garbage', askedName: true };
  const store = { get: (key) => data[key] };
  const s = readSettings(store);
  assert.equal(s.name, 'Priya');
  assert.equal(s.intervalMin, DEFAULTS.intervalMin);
  assert.equal('askedName' in s, false);
});
