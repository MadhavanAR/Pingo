'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LIMITS,
  DEFAULT_REMINDER,
  normalizeReminder,
  normalizeReminders,
  legacyReminder,
  isAllowedAt,
  nextDue,
} = require('../src/main/reminders');

// Local-time dates, so the tests pass in any time zone. 2026-11-02 is a Monday.
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m).getTime();

test('normalizeReminder fills defaults and keeps a stable id', () => {
  const r = normalizeReminder({});
  assert.match(r.id, /^[a-z0-9]+$/);
  assert.equal(r.type, DEFAULT_REMINDER.type);
  assert.equal(normalizeReminder({ message: 'x' }, r).id, r.id);
});

test('normalizeReminder cleans every field', () => {
  const r = normalizeReminder({
    id: '../etc',
    type: 'rocket',
    message: `  Take\nyour pills ${'x'.repeat(500)}`,
    everyMin: 99999,
    times: ['21:00', 'nope', '09:00', '09:00', '25:00'],
    days: [9, 1, 1, 'x', 5],
    start: '08:30',
    end: -4,
    snoozeMin: 0,
    avatar: 42,
  });
  assert.notEqual(r.id, '../etc');
  assert.equal(r.type, 'custom');
  assert.ok(r.message.startsWith('Take your pills'));
  assert.equal(r.message.length, LIMITS.MESSAGE_MAX_LENGTH);
  assert.equal(r.everyMin, LIMITS.MAX_INTERVAL_MIN);
  assert.deepEqual(r.times, ['09:00', '21:00']);
  assert.deepEqual(r.days, [1, 5]);
  assert.equal(r.start, 8 * 60 + 30);
  assert.equal(r.end, 0);
  assert.equal(r.snoozeMin, 1);
  assert.equal(r.avatar, null);
  assert.deepEqual(normalizeReminder({ days: [] }).days, [0, 1, 2, 3, 4, 5, 6]);
});

test('normalizeReminders drops duplicate ids and caps the count', () => {
  const list = normalizeReminders([{ id: 'a1' }, { id: 'a1' }, 'junk']);
  assert.equal(list.length, 3);
  assert.equal(new Set(list.map((r) => r.id)).size, 3);
  const many = normalizeReminders(Array.from({ length: 80 }, () => ({})));
  assert.equal(many.length, LIMITS.MAX_REMINDERS);
  assert.deepEqual(normalizeReminders('nope'), []);
});

test('legacyReminder carries over the old flat settings', () => {
  const old = {
    message: 'Stretch',
    intervalMin: 30,
    snoozeMin: 5,
    activeStartHour: 9,
    activeEndHour: 17,
  };
  const r = legacyReminder((key) => old[key]);
  assert.equal(r.type, 'custom');
  assert.equal(r.everyMin, 30);
  assert.equal(r.start, 9 * 60);
  assert.equal(r.end, 17 * 60);
  assert.equal(legacyReminder(() => undefined).type, 'water');
});

test('isAllowedAt checks the day and the hours, which may wrap midnight', () => {
  const weekdays = normalizeReminder({ days: [1, 2, 3, 4, 5], start: 9 * 60, end: 17 * 60 });
  assert.equal(isAllowedAt(weekdays, new Date(at(2, 10))), true); // Monday
  assert.equal(isAllowedAt(weekdays, new Date(at(2, 17))), false); // end is exclusive
  assert.equal(isAllowedAt(weekdays, new Date(at(1, 10))), false); // Sunday
  const night = normalizeReminder({ start: 22 * 60, end: 6 * 60 });
  assert.equal(isAllowedAt(night, new Date(at(2, 23))), true);
  assert.equal(isAllowedAt(night, new Date(at(2, 3))), true);
  assert.equal(isAllowedAt(night, new Date(at(2, 12))), false);
  const allDay = normalizeReminder({ start: 0, end: 0 });
  assert.equal(isAllowedAt(allDay, new Date(at(2, 3))), true);
});

test('interval reminders count down, then wait for their hours to open', () => {
  const r = normalizeReminder({ everyMin: 45, start: 10 * 60, end: 23 * 60 });
  assert.equal(nextDue(r, at(2, 12)), at(2, 12, 45));
  assert.equal(nextDue(r, at(2, 22, 30)), at(3, 10)); // would land at 23:15
  const weekdays = normalizeReminder({
    everyMin: 60,
    days: [1, 2, 3, 4, 5],
    start: 9 * 60,
    end: 17 * 60,
  });
  assert.equal(nextDue(weekdays, at(6, 16, 30)), at(9, 9)); // Friday evening -> Monday 09:00
});

test('set-time reminders pick the next time on an allowed day', () => {
  const r = normalizeReminder({ mode: 'times', times: ['09:00', '21:00'], days: [1, 3] });
  assert.equal(nextDue(r, at(2, 8)), at(2, 9));
  assert.equal(nextDue(r, at(2, 9)), at(2, 21)); // strictly after
  assert.equal(nextDue(r, at(2, 22)), at(4, 9)); // Tuesday skipped
});

test('a switched-off reminder is never due', () => {
  assert.equal(nextDue(normalizeReminder({ enabled: false }), at(2, 12)), null);
});
