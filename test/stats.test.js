'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { STATS_DAYS } = require('../src/main/config');
const { recordEvent, summarize } = require('../src/main/stats');

test('counts done and snoozed per reminder per day', () => {
  const day = new Date(2026, 10, 3, 12);
  let stats = recordEvent(undefined, 'water', 'done', day);
  stats = recordEvent(stats, 'water', 'done', day);
  stats = recordEvent(stats, 'stretch', 'snoozed', day);
  const s = summarize(stats, day);
  assert.deepEqual(s.today, { done: 2, snoozed: 1 });
  assert.deepEqual(s.doneToday, { water: 2 });
  assert.equal(s.week.length, 7);
  assert.equal(s.week[6].done, 2);
  assert.equal(
    s.week.reduce((n, d) => n + d.done, 0),
    2,
  );
});

test('keeps only the most recent days', () => {
  let stats = {};
  for (let d = 1; d <= 30; d++) stats = recordEvent(stats, 'a', 'done', new Date(2026, 9, d));
  assert.equal(Object.keys(stats).length, STATS_DAYS);
  assert.ok(stats['2026-10-30']);
  assert.equal(stats['2026-10-01'], undefined);
});
