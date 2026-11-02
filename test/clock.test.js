'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hourInZone, isWithinHours } = require('../src/main/clock');

const IST = 'Asia/Kolkata';

// IST is UTC+05:30 with no DST.
const atIST = (h, m = 0) => new Date(Date.UTC(2026, 0, 15, h, m) - 5.5 * 3600_000);
const within = (startHour, endHour, date) =>
  isWithinHours({ startHour, endHour, timeZone: IST }, date);

test('hourInZone converts to the target zone regardless of host zone', () => {
  assert.equal(hourInZone(IST, atIST(9, 59)), 9);
  assert.equal(hourInZone(IST, atIST(0, 0)), 0);
  assert.equal(hourInZone('UTC', new Date(Date.UTC(2026, 0, 15, 17))), 17);
});

test('hourInZone defaults to the local zone', () => {
  const now = new Date();
  assert.equal(hourInZone(undefined, now), now.getHours());
});

test('a daytime range includes its start and excludes its end', () => {
  assert.equal(within(10, 23, atIST(9, 59)), false);
  assert.equal(within(10, 23, atIST(10, 0)), true);
  assert.equal(within(10, 23, atIST(22, 59)), true);
  assert.equal(within(10, 23, atIST(23, 0)), false);
});

test('a range can wrap past midnight', () => {
  assert.equal(within(22, 6, atIST(23, 0)), true);
  assert.equal(within(22, 6, atIST(2, 0)), true);
  assert.equal(within(22, 6, atIST(6, 0)), false);
  assert.equal(within(22, 6, atIST(12, 0)), false);
});

test('equal start and end means any time of day', () => {
  for (const h of [0, 5, 12, 23]) assert.equal(within(0, 0, atIST(h)), true);
});
