'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../src/main/scheduler');

const MIN = 60_000;

function setup({ active = true, visible = false } = {}) {
  const state = { now: 0, active, visible, due: 0, changes: 0 };
  const scheduler = new Scheduler({
    intervalMin: 45,
    tickMs: 1000,
    isActiveHours: () => state.active,
    isReminderVisible: () => state.visible,
    now: () => state.now,
  });
  scheduler.on('due', () => state.due++);
  scheduler.on('change', () => state.changes++);
  return { scheduler, state };
}

test('fires only once the interval has elapsed', () => {
  const { scheduler, state } = setup();
  state.now = 44 * MIN;
  scheduler.tick();
  assert.equal(state.due, 0);
  state.now = 45 * MIN;
  scheduler.tick();
  assert.equal(state.due, 1);
});

test('stays quiet outside active hours, while paused, or while already visible', () => {
  for (const opts of [{ active: false }, { visible: true }]) {
    const { scheduler, state } = setup(opts);
    state.now = 999 * MIN;
    scheduler.tick();
    assert.equal(state.due, 0, JSON.stringify(opts));
  }
  const { scheduler, state } = setup();
  scheduler.setPaused(true);
  state.now = 999 * MIN;
  scheduler.tick();
  assert.equal(state.due, 0);
  assert.equal(scheduler.canRemind(), false);
});

test('unpausing restarts the full countdown', () => {
  const { scheduler, state } = setup();
  scheduler.setPaused(true);
  state.now = 100 * MIN;
  scheduler.setPaused(false);
  assert.equal(scheduler.minutesUntilNext(), 45);
});

test('snooze and interval changes reschedule and emit change', () => {
  const { scheduler, state } = setup();
  scheduler.snooze(10);
  assert.equal(scheduler.minutesUntilNext(), 10);
  scheduler.setIntervalMinutes(30);
  assert.equal(scheduler.intervalMin, 30);
  assert.equal(scheduler.minutesUntilNext(), 30);
  assert.equal(state.changes, 2);
});

test('minutesUntilNext never goes negative', () => {
  const { scheduler, state } = setup();
  state.now = 500 * MIN;
  assert.equal(scheduler.minutesUntilNext(), 0);
});
