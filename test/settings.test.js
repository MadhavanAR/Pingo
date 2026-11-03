'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, LIMITS, normalizeSettings, readSettings } = require('../src/main/settings');

test('defaults are returned for an empty patch', () => {
  assert.deepEqual(normalizeSettings({}), DEFAULTS);
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
});

test('a patch only changes the fields it contains', () => {
  const base = normalizeSettings({ name: 'Alex', side: 'left' });
  const next = normalizeSettings({ size: 120 }, base);
  assert.equal(next.name, 'Alex');
  assert.equal(next.side, 'left');
  assert.equal(next.size, 120);
});

test('names are cleaned and length-capped', () => {
  assert.equal(normalizeSettings({ name: '  Al\nex\u0007  ' }).name, 'Al ex');
  assert.equal(normalizeSettings({ name: 'x'.repeat(100) }).name.length, LIMITS.NAME_MAX_LENGTH);
});

test('choices outside the allowed set fall back to defaults', () => {
  const s = normalizeSettings({ theme: 'dark', accent: 'violet', side: 'top', sound: 'airhorn' });
  assert.equal(s.theme, DEFAULTS.theme);
  assert.equal(s.accent, DEFAULTS.accent);
  assert.equal(s.side, DEFAULTS.side);
  assert.equal(s.sound, DEFAULTS.sound);
});

test('numbers are rounded and clamped', () => {
  const s = normalizeSettings({ size: 999, autoHideMin: '4.6' });
  assert.equal(s.size, LIMITS.MAX_SIZE);
  assert.equal(s.autoHideMin, 5);
  assert.equal(normalizeSettings({ size: 'abc' }).size, DEFAULTS.size);
});

test('unknown fields are dropped', () => {
  assert.equal('isAdmin' in normalizeSettings({ isAdmin: true }), false);
});

test('readSettings validates whatever is on disk', () => {
  const data = { name: 'Priya', size: 'garbage', askedName: true };
  const store = { get: (key) => data[key] };
  const s = readSettings(store);
  assert.equal(s.name, 'Priya');
  assert.equal(s.size, DEFAULTS.size);
  assert.equal('askedName' in s, false);
});
