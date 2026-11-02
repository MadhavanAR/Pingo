'use strict';

const { EventEmitter } = require('node:events');
const { MINUTE_MS } = require('./config');

/**
 * Decides *when* a reminder is due. It polls on a short timer and compares
 * against the wall clock instead of arming one long setTimeout, so reminders
 * keep working after the laptop sleeps and wakes.
 *
 * Emits:
 *   'due'     — a reminder should be shown now
 *   'change'  — next-due time, interval or paused state changed
 */
class Scheduler extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} opts.intervalMin minutes between reminders
   * @param {number} opts.tickMs poll period
   * @param {() => boolean} opts.isActiveHours whether reminders are allowed right now
   * @param {() => boolean} opts.isReminderVisible whether a reminder is already on screen
   * @param {() => number} [opts.now] clock, injectable for tests
   */
  constructor({ intervalMin, tickMs, isActiveHours, isReminderVisible, now = Date.now }) {
    super();
    this.intervalMin = intervalMin;
    this.tickMs = tickMs;
    this.isActiveHours = isActiveHours;
    this.isReminderVisible = isReminderVisible;
    this.now = now;
    this.paused = false;
    this.nextAt = now() + intervalMin * MINUTE_MS;
    this.timer = null;
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

  /** True when a reminder may be shown at all (not paused, inside active hours). */
  canRemind() {
    return !this.paused && this.isActiveHours();
  }

  tick() {
    if (!this.canRemind() || this.isReminderVisible()) return;
    if (this.now() >= this.nextAt) this.emit('due');
  }

  scheduleIn(ms) {
    this.nextAt = this.now() + ms;
    this.emit('change');
  }

  /** Restart the countdown with the full interval. */
  restart() {
    this.scheduleIn(this.intervalMin * MINUTE_MS);
  }

  snooze(minutes) {
    this.scheduleIn(minutes * MINUTE_MS);
  }

  setIntervalMinutes(minutes) {
    this.intervalMin = minutes;
    this.restart();
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.emit('change');
    else this.restart();
  }

  /** Whole minutes until the next reminder, never negative. */
  minutesUntilNext() {
    return Math.max(0, Math.round((this.nextAt - this.now()) / MINUTE_MS));
  }
}

module.exports = { Scheduler };
