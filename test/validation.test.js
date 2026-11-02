'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeInterval, normalizeName, dataUrlToBuffer } = require('../src/main/validation');
const { SCHEDULE, NAME_MAX_LENGTH } = require('../src/main/config');

test('normalizeInterval rounds, clamps and falls back to the default', () => {
  assert.equal(normalizeInterval(30), 30);
  assert.equal(normalizeInterval('44.6'), 45);
  assert.equal(normalizeInterval(99999), SCHEDULE.MAX_INTERVAL_MIN);
  for (const bad of [0, -5, NaN, 'abc', undefined, null, Infinity]) {
    assert.equal(normalizeInterval(bad), SCHEDULE.DEFAULT_INTERVAL_MIN, String(bad));
  }
});

test('normalizeName trims, strips control characters and caps length', () => {
  assert.equal(normalizeName('  Alex  '), 'Alex');
  assert.equal(normalizeName('Al\nex\u0007'), 'Alex');
  assert.equal(normalizeName(undefined), '');
  assert.equal(normalizeName('x'.repeat(100)).length, NAME_MAX_LENGTH);
});

test('dataUrlToBuffer accepts only base64 image data URLs within the size cap', () => {
  const png = 'data:image/png;base64,' + Buffer.from('hello').toString('base64');
  assert.deepEqual(dataUrlToBuffer(png), Buffer.from('hello'));
  assert.equal(dataUrlToBuffer(png, 4), null);
  assert.equal(dataUrlToBuffer('data:text/html;base64,PGI+'), null);
  assert.equal(dataUrlToBuffer('data:image/png;base64,'), null);
  assert.equal(dataUrlToBuffer(42), null);
});
