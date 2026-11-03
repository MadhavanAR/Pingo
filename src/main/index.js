'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, nativeTheme, powerMonitor } = require('electron');
const { APP_NAME, LEGACY_USER_DATA_DIRS, MINUTE_MS, SCHEDULE } = require('./config');
const { CHANNELS } = require('../shared/channels');
const { normalizeSettings, readSettings } = require('./settings');
const {
  LIMITS: REMINDER_LIMITS,
  TYPES,
  DEFAULT_REMINDER,
  isAllowedAt,
  legacyReminder,
  normalizeReminder,
  normalizeReminders,
} = require('./reminders');
const { recordEvent, summarize } = require('./stats');
const { Store } = require('./store');
const { Scheduler } = require('./scheduler');
const { Characters } = require('./characters');
const { createPetWindow, positionPetWindow, DialogManager } = require('./windows');
const { AppTray } = require('./tray');
const { registerIpc } = require('./ipc');

const DIALOGS = Object.freeze({
  app: {
    page: 'app.html',
    title: APP_NAME,
    width: 1080,
    height: 740,
    minWidth: 820,
    minHeight: 600,
  },
  onboarding: { page: 'onboarding.html', title: `Welcome to ${APP_NAME}`, width: 560, height: 640 },
});

/** Longest timed pause from the renderer; "until resumed" is separate. */
const MAX_PAUSE_MIN = 24 * 60;

/**
 * Users upgrading from "Hydrate Buddy" keep their name, interval and custom
 * character: copy the old user-data folder once if the new one is empty.
 */
function migrateLegacyUserData(userDataDir) {
  if (fs.existsSync(path.join(userDataDir, 'config.json'))) return;
  const appData = app.getPath('appData');
  for (const legacy of LEGACY_USER_DATA_DIRS) {
    const from = path.join(appData, legacy);
    if (!fs.existsSync(path.join(from, 'config.json'))) continue;
    fs.mkdirSync(userDataDir, { recursive: true });
    for (const file of ['config.json', 'custom-idle.png', 'custom-drinking.png']) {
      const src = path.join(from, file);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(userDataDir, file));
    }
    return;
  }
}

function startOfTomorrow(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

/** Application controller: owns state and coordinates window, tray and timer. */
class PingoApp {
  constructor() {
    const userDataDir = app.getPath('userData');
    try {
      migrateLegacyUserData(userDataDir);
    } catch (err) {
      console.warn('Legacy settings migration skipped:', err);
    }

    this.quitting = false;
    this.store = new Store(path.join(userDataDir, 'config.json'));
    this.characters = new Characters({ userDataDir, store: this.store });
    this.characters.migrateLegacy();
    this.dialogs = new DialogManager();
    this.settings = readSettings(this.store);
    this.reminders = this.loadReminders();
    /** The reminder on screen: { reminder, preview } or null. */
    this.current = null;
    nativeTheme.themeSource = this.settings.theme;

    this.scheduler = new Scheduler({
      reminders: this.reminders,
      tickMs: SCHEDULE.TICK_MS,
      isReminderVisible: () => this.pet.isVisible(),
    });
    this.pet = createPetWindow({ shouldHideOnClose: () => !this.quitting });
    this.tray = new AppTray(this.trayController());

    this.scheduler.on('due', (reminder) => this.show(reminder));
    this.scheduler.on('change', () => this.changed());
    nativeTheme.on('updated', () => this.changed());
    registerIpc({ pingo: this });
  }

  /** Saved reminders, or the single reminder older versions kept as settings. */
  loadReminders() {
    const saved = this.store.get('reminders');
    if (Array.isArray(saved)) return normalizeReminders(saved);
    const first = legacyReminder((key) => this.store.get(key));
    this.store.set({ reminders: [first] });
    return [first];
  }

  start() {
    this.scheduler.start();

    // First launch: run the welcome wizard and greet only once it's done, so
    // the character and the wizard don't both pop up at once.
    if (!this.store.get('askedName', false)) {
      this.store.set({ askedName: true });
      setTimeout(() => this.openOnboarding(), SCHEDULE.ONBOARDING_DELAY_MS);
    } else {
      // Returning user: say hello shortly after launch so they see it works.
      setTimeout(() => this.greet(), SCHEDULE.GREETING_DELAY_MS);
    }

    // Re-check the moment the laptop wakes/unlocks so a due nudge isn't missed.
    for (const event of ['resume', 'unlock-screen']) {
      powerMonitor.on(event, () => this.scheduler.tick());
    }
  }

  /** Show an every-N-minutes reminder that is in its hours right now, if any. */
  greet() {
    const now = new Date();
    const reminder = this.reminders.find(
      (r) => r.enabled && r.mode === 'interval' && isAllowedAt(r, now),
    );
    if (reminder && !this.scheduler.paused && !this.pet.isVisible()) this.show(reminder);
  }

  /**
   * Walk the character on with `reminder`. A preview (from the editor or the
   * avatar studio) never touches the schedule or today's counts.
   */
  show(reminder, { preview = false } = {}) {
    if (!preview && (this.scheduler.paused || this.pet.isVisible())) return;
    if (!preview) {
      // Re-read each time: at login the roaming profile may not have been ready
      // when settings were first loaded.
      this.store.reload();
      this.settings = readSettings(this.store);
    }
    this.current = { reminder, preview };

    positionPetWindow(this.pet, this.settings);
    this.pet.showInactive(); // appear without stealing keyboard focus
    this.pet.setAlwaysOnTop(true, 'screen-saver');
    const { name, bubbleStyle, accent, side, size, sound, autoHideMin } = this.settings;
    this.pet.webContents.send(CHANNELS.REMINDER_SHOW, {
      type: reminder.type,
      message: reminder.message,
      snoozeMin: reminder.snoozeMin,
      name,
      preview,
      sprites: this.characters.sprites(reminder.avatar),
      look: {
        bubbleStyle,
        accent,
        side,
        size,
        sound,
        autoHideMin,
        dark: nativeTheme.shouldUseDarkColors,
      },
    });
  }

  /** Show whichever reminder is due soonest, right now. */
  remindNow() {
    const next = this.scheduler.upcoming()[0];
    if (next) this.show(next.reminder);
  }

  done() {
    const current = this.current;
    if (!current || current.preview) return;
    this.recordStat(current.reminder.id, 'done');
    this.scheduler.complete(current.reminder.id);
  }

  snooze() {
    const current = this.current;
    if (!current || current.preview) return;
    this.recordStat(current.reminder.id, 'snoozed');
    this.scheduler.snooze(current.reminder.id, current.reminder.snoozeMin);
  }

  hidePet() {
    this.pet.hide();
    this.current = null;
    // Anything that fell due while this one was up gets its turn.
    setTimeout(() => this.scheduler.tick(), 1500);
  }

  recordStat(id, kind) {
    this.store.set({ stats: recordEvent(this.store.get('stats'), id, kind) });
  }

  /** Refresh everything that mirrors app state; passes `result` through. */
  changed(result) {
    this.tray?.refresh();
    this.dialogs?.broadcast(CHANNELS.STATE_CHANGED);
    return result;
  }

  /** Validate, persist and apply any subset of settings; returns the result. */
  updateSettings(patch) {
    this.settings = normalizeSettings(patch, this.settings);
    this.store.set(this.settings);
    nativeTheme.themeSource = this.settings.theme;
    return this.changed(this.settings);
  }

  setReminders(list) {
    this.reminders = list;
    this.store.set({ reminders: list });
    this.scheduler.setReminders(list); // emits 'change'
  }

  /** Create or update a reminder from any subset of fields. */
  saveReminder(patch) {
    const existing = this.reminders.find((r) => r.id === patch?.id);
    if (!existing && this.reminders.length >= REMINDER_LIMITS.MAX_REMINDERS) return null;
    const reminder = normalizeReminder(patch, existing ?? DEFAULT_REMINDER);
    this.setReminders(
      existing
        ? this.reminders.map((r) => (r.id === reminder.id ? reminder : r))
        : [...this.reminders, reminder],
    );
    return reminder;
  }

  deleteReminder(id) {
    if (!this.reminders.some((r) => r.id === id)) return false;
    this.setReminders(this.reminders.filter((r) => r.id !== id));
    return true;
  }

  /** Show a reminder (saved or still being edited) without scheduling it. */
  previewReminder(draft) {
    const base = this.reminders.find((r) => r.id === draft?.id) ?? DEFAULT_REMINDER;
    this.show(normalizeReminder(draft, base), { preview: true });
    return true;
  }

  /**
   * @param {number | 'tomorrow'} minutes 0 resumes, -1 pauses until resumed,
   *   'tomorrow' until midnight, otherwise that many minutes.
   */
  setPaused(minutes) {
    if (minutes === 0) {
      this.scheduler.resume();
    } else {
      let until;
      if (minutes === -1) until = Infinity;
      else if (minutes === 'tomorrow') until = startOfTomorrow();
      else {
        const n = Math.round(Number(minutes));
        if (!Number.isFinite(n) || n <= 0) return this.state();
        until = Date.now() + Math.min(n, MAX_PAUSE_MIN) * MINUTE_MS;
      }
      this.scheduler.pauseUntil(until);
      if (this.current && !this.current.preview) this.hidePet();
    }
    return this.state();
  }

  setOpenAtLogin(enabled) {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled });
    return this.changed(this.state());
  }

  /** Everything the control center shows, in one structured-clone-safe object. */
  state() {
    const summary = summarize(this.store.get('stats'));
    const until = this.scheduler.paused ? this.scheduler.pausedUntil : 0;
    return {
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      openAtLogin: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
      now: Date.now(),
      settings: this.settings,
      defaultAvatar: this.characters.defaultKey(),
      pausedUntil: until === Infinity ? -1 : until,
      maxReminders: REMINDER_LIMITS.MAX_REMINDERS,
      reminders: this.reminders.map((r) => ({
        ...r,
        nextAt: this.scheduler.nextAt.get(r.id) ?? null,
        doneToday: summary.doneToday[r.id] ?? 0,
      })),
      today: summary.today,
      week: summary.week,
    };
  }

  openApp(route = 'home') {
    if (route === 'onboarding') return this.openOnboarding();
    const { page, ...spec } = DIALOGS.app;
    this.dialogs.show(page, { ...spec, hash: route.replace(/[^a-z0-9/-]/gi, '') });
  }

  openOnboarding() {
    const { page, ...spec } = DIALOGS.onboarding;
    const onClosed = () => setTimeout(() => this.remindNow(), SCHEDULE.POST_ONBOARDING_DELAY_MS);
    this.dialogs.show(page, { ...spec, onClosed });
  }

  quit() {
    this.quitting = true;
    app.quit();
  }

  /** @returns {import('./tray').TrayController} */
  trayController() {
    return {
      nextUp: () => {
        const next = this.scheduler.upcoming()[0];
        if (!next) return null;
        return { title: reminderTitle(next.reminder), at: next.at };
      },
      pausedUntil: () => (this.scheduler.paused ? this.scheduler.pausedUntil : 0),
      remindNow: () => this.remindNow(),
      openApp: (route) => this.openApp(route),
      openOnboarding: () => this.openOnboarding(),
      pause: (minutes) => this.setPaused(minutes),
      resume: () => this.setPaused(0),
      quit: () => this.quit(),
    };
  }
}

/** Short name for menus: the user's own words, or the type's label. */
function reminderTitle(reminder) {
  const text = reminder.message || TYPES[reminder.type].label;
  return text.length > 32 ? `${text.slice(0, 31)}…` : text;
}

function main() {
  // Pin the settings folder to the product name in dev and packaged builds alike.
  app.setName(APP_NAME);
  app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));
  // Development and screenshots can point at a throwaway profile instead.
  if (!app.isPackaged && process.env.PINGO_USER_DATA) {
    app.setPath('userData', path.resolve(process.env.PINGO_USER_DATA));
  }

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  let pingo = null;
  app.on('second-instance', () => pingo?.openApp('home'));

  // Tray-only app: stay alive with no windows open.
  app.on('window-all-closed', () => {});

  // Let Cmd+Q, logout and shutdown really close the pet window (its 'close'
  // handler otherwise just hides it and cancels the quit).
  app.on('before-quit', () => {
    if (pingo) pingo.quitting = true;
  });

  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide();
    pingo = new PingoApp();
    pingo.start();
  });
}

main();

module.exports = { PingoApp };
