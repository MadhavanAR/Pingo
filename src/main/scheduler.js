'use strict';

const { EventEmitter } = require('node:events');
const { MINUTE_MS } = require('./config');
const { isAllowedAt, nextAllowedFrom, nextDue, scheduleKey } = require('./reminders');

/**
 * Decides *when* each reminder is due. It polls on a short timer and compares
 * against the wall clock instead of arming long setTimeouts, so reminders
 * keep working after the laptop sleeps and wakes.
 *
 * Only one reminder is on screen at a time; anything else that falls due
 * waits for the next tick after it is dismissed.
 *
 * Emits:
 *   'due'     (reminder) — this reminder should be shown now
 *   'change'  — a next-due time, the reminder list or the paused state changed
 */
class Scheduler extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object[]} [opts.reminders] normalized reminders
   * @param {number} opts.tickMs poll period
   * @param {() => boolean} opts.isReminderVisible whether a reminder is already on screen
   * @param {() => number} [opts.now] clock, injectable for tests
   */
  constructor({ reminders = [], tickMs, isReminderVisible, now = Date.now }) {
    super();
    this.tickMs = tickMs;
    this.isReminderVisible = isReminderVisible;
    this.now = now;
    this.reminders = [];
    /** @type {Map<string, number | null>} reminder id -> next due time (ms) */
    this.nextAt = new Map();
    this.pausedUntil = 0; // ms timestamp; Infinity = until resumed
    this.timer = null;
    this.setReminders(reminders);
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get paused() {
    return this.pausedUntil > this.now();
  }

  /** Replace the list. Reminders whose timing didn't change keep their countdown. */
  setReminders(list) {
    const previous = new Map(this.reminders.map((r) => [r.id, r]));
    const now = this.now();
    const nextAt = new Map();
    for (const r of list) {
      const before = previous.get(r.id);
      const keep = before && scheduleKey(before) === scheduleKey(r) && this.nextAt.has(r.id);
      nextAt.set(r.id, keep ? this.nextAt.get(r.id) : nextDue(r, now));
    }
    this.reminders = list;
    this.nextAt = nextAt;
    this.emit('change');
  }

  get(id) {
    return this.reminders.find((r) => r.id === id) ?? null;
  }

  tick() {
    if (this.pausedUntil && !this.paused) this.resume();
    if (this.paused || this.isReminderVisible()) return;
    const now = this.now();
    let due = null;
    let dueAt = Infinity;
    for (const r of this.reminders) {
      const at = this.nextAt.get(r.id);
      if (at === null || at === undefined || at > now) continue;
      // Woke up after hours: wait for the hours to open instead of firing late.
      if (r.mode === 'interval' && !isAllowedAt(r, new Date(now))) {
        this.nextAt.set(r.id, nextAllowedFrom(r, now));
        this.emit('change');
        continue;
      }
      if (at < dueAt) {
        due = r;
        dueAt = at;
      }
    }
    if (due) this.emit('due', due);
  }

  /** The reminder was shown and answered: count down to its next time. */
  complete(id) {
    const r = this.get(id);
    if (!r) return;
    this.nextAt.set(id, nextDue(r, this.now()));
    this.emit('change');
  }

  snooze(id, minutes) {
    if (!this.get(id)) return;
    this.nextAt.set(id, this.now() + minutes * MINUTE_MS);
    this.emit('change');
  }

  /** Pause until `until` (ms timestamp, or Infinity for "until resumed"). */
  pauseUntil(until) {
    this.pausedUntil = until;
    this.emit('change');
  }

  /** Resume and start every countdown afresh, so nothing piles up at once. */
  resume() {
    this.pausedUntil = 0;
    const now = this.now();
    for (const r of this.reminders) this.nextAt.set(r.id, nextDue(r, now));
    this.emit('change');
  }

  /** Scheduled reminders, soonest first: [{ reminder, at }]. */
  upcoming() {
    return this.reminders
      .map((reminder) => ({ reminder, at: this.nextAt.get(reminder.id) }))
      .filter((item) => item.at !== null && item.at !== undefined)
      .sort((a, b) => a.at - b.at);
  }

  /** Whole minutes until `at`, never negative. */
  minutesUntil(at) {
    return Math.max(0, Math.round((at - this.now()) / MINUTE_MS));
  }
}

module.exports = { Scheduler };
