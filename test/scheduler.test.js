'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../src/main/scheduler');
const { normalizeReminder } = require('../src/main/reminders');

const MIN = 60_000;
// Monday 2026-11-02, 12:00 local time.
const NOON = new Date(2026, 10, 2, 12).getTime();

const allDay = (patch) => normalizeReminder({ start: 0, end: 0, ...patch });

function setup(reminders, { visible = false } = {}) {
  const state = { now: NOON, visible, due: [], changes: 0 };
  const scheduler = new Scheduler({
    reminders,
    tickMs: 1000,
    isReminderVisible: () => state.visible,
    now: () => state.now,
  });
  scheduler.on('due', (r) => state.due.push(r.id));
  scheduler.on('change', () => state.changes++);
  return { scheduler, state };
}

test('fires only once the interval has elapsed', () => {
  const { scheduler, state } = setup([allDay({ id: 'water', everyMin: 45 })]);
  state.now = NOON + 44 * MIN;
  scheduler.tick();
  assert.deepEqual(state.due, []);
  state.now = NOON + 45 * MIN;
  scheduler.tick();
  assert.deepEqual(state.due, ['water']);
});

test('the most overdue of several reminders goes first, one at a time', () => {
  const { scheduler, state } = setup([
    allDay({ id: 'water', everyMin: 30 }),
    allDay({ id: 'stretch', everyMin: 20 }),
  ]);
  state.now = NOON + 60 * MIN;
  scheduler.tick();
  assert.deepEqual(state.due, ['stretch']);
  scheduler.complete('stretch');
  scheduler.tick();
  assert.deepEqual(state.due, ['stretch', 'water']);
});

test('stays quiet while paused or while a reminder is visible', () => {
  const visible = setup([allDay({ id: 'a', everyMin: 1 })], { visible: true });
  visible.state.now += 999 * MIN;
  visible.scheduler.tick();
  assert.deepEqual(visible.state.due, []);

  const { scheduler, state } = setup([allDay({ id: 'a', everyMin: 1 })]);
  scheduler.pauseUntil(Infinity);
  state.now += 999 * MIN;
  scheduler.tick();
  assert.deepEqual(state.due, []);
  assert.equal(scheduler.paused, true);
});

test('a timed pause ends by itself and restarts every countdown', () => {
  const { scheduler, state } = setup([allDay({ id: 'a', everyMin: 30 })]);
  scheduler.pauseUntil(NOON + 60 * MIN);
  state.now = NOON + 61 * MIN;
  scheduler.tick();
  assert.equal(scheduler.paused, false);
  assert.deepEqual(state.due, [], 'resuming must not fire everything at once');
  assert.equal(scheduler.minutesUntil(scheduler.upcoming()[0].at), 30);
});

test('after hours, an overdue interval reminder waits for the morning', () => {
  const r = normalizeReminder({ id: 'a', everyMin: 30, start: 9 * 60, end: 17 * 60 });
  const { scheduler, state } = setup([r]);
  state.now = new Date(2026, 10, 2, 20).getTime(); // laptop woke at 20:00
  scheduler.tick();
  assert.deepEqual(state.due, []);
  assert.equal(scheduler.upcoming()[0].at, new Date(2026, 10, 3, 9).getTime());
});

test('snooze reschedules just that reminder', () => {
  const { scheduler } = setup([
    allDay({ id: 'a', everyMin: 45 }),
    allDay({ id: 'b', everyMin: 90 }),
  ]);
  scheduler.snooze('b', 10);
  const next = scheduler.upcoming();
  assert.equal(next[0].reminder.id, 'b');
  assert.equal(scheduler.minutesUntil(next[0].at), 10);
});

test('editing a reminder restarts only its own countdown', () => {
  const a = allDay({ id: 'a', everyMin: 45 });
  const b = allDay({ id: 'b', everyMin: 60 });
  const { scheduler, state } = setup([a, b]);
  scheduler.snooze('a', 5);
  state.now += 2 * MIN;
  scheduler.setReminders([
    { ...a, message: 'renamed' },
    { ...b, everyMin: 30 },
  ]);
  const byId = Object.fromEntries(scheduler.upcoming().map((u) => [u.reminder.id, u.at]));
  assert.equal(byId.a, NOON + 5 * MIN, 'a kept its snooze');
  assert.equal(byId.b, state.now + 30 * MIN, 'b restarted');
  scheduler.setReminders([a]);
  assert.equal(scheduler.upcoming().length, 1);
});

test('minutesUntil never goes negative', () => {
  const { scheduler } = setup([]);
  assert.equal(scheduler.minutesUntil(0), 0);
});
