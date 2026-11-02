'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hourInZone, isWithinHours } = require('../src/main/clock');

const IST = 'Asia/Kolkata';
const window = { timeZone: IST, startHour: 10, endHour: 23 };

// IST is UTC+05:30 with no DST.
const atIST = (h, m = 0) => new Date(Date.UTC(2026, 0, 15, h, m) - 5.5 * 3600_000);

test('hourInZone converts to the target zone regardless of host zone', () => {
  assert.equal(hourInZone(IST, atIST(9, 59)), 9);
  assert.equal(hourInZone(IST, atIST(0, 0)), 0);
  assert.equal(hourInZone('UTC', new Date(Date.UTC(2026, 0, 15, 17))), 17);
});

test('isWithinHours is inclusive of start and exclusive of end', () => {
  assert.equal(isWithinHours(window, atIST(9, 59)), false);
  assert.equal(isWithinHours(window, atIST(10, 0)), true);
  assert.equal(isWithinHours(window, atIST(22, 59)), true);
  assert.equal(isWithinHours(window, atIST(23, 0)), false);
});
