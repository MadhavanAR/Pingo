'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, powerMonitor } = require('electron');
const { APP_NAME, LEGACY_USER_DATA_DIRS, SCHEDULE } = require('./config');
const { CHANNELS } = require('../shared/channels');
const { isWithinHours } = require('./clock');
const { normalizeInterval, normalizeName } = require('./validation');
const { Store } = require('./store');
const { Scheduler } = require('./scheduler');
const { Characters } = require('./characters');
const { createPetWindow, positionPetWindow, DialogManager } = require('./windows');
const { AppTray } = require('./tray');
const { registerIpc } = require('./ipc');

const DIALOGS = Object.freeze({
  name: { page: 'name.html', title: 'Your name', width: 380, height: 240 },
  interval: { page: 'interval.html', title: 'Reminder interval', width: 380, height: 250 },
  onboarding: { page: 'onboarding.html', title: `Welcome to ${APP_NAME}`, width: 430, height: 450 },
  character: { page: 'character.html', title: 'Change character', width: 470, height: 640 },
});

const isActiveHours = () =>
  isWithinHours({
    timeZone: SCHEDULE.TIME_ZONE,
    startHour: SCHEDULE.ACTIVE_START_HOUR,
    endHour: SCHEDULE.ACTIVE_END_HOUR,
  });

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
    this.dialogs = new DialogManager();
    this.name = normalizeName(this.store.get('name', ''));
    this.scheduler = new Scheduler({
      intervalMin: normalizeInterval(this.store.get('intervalMin')),
      tickMs: SCHEDULE.TICK_MS,
      isActiveHours,
      isReminderVisible: () => this.pet.isVisible(),
    });
    this.pet = createPetWindow({ shouldHideOnClose: () => !this.quitting });
    this.tray = new AppTray(this.trayController());

    this.scheduler.on('due', () => this.remind());
    this.scheduler.on('change', () => this.tray.refresh());
    registerIpc({ pingo: this });
  }

  start() {
    this.scheduler.start();

    // First launch: run the welcome wizard and greet only once it's done, so
    // the character and the wizard don't both pop up at once.
    if (!this.store.get('askedName', false)) {
      this.store.set({ askedName: true });
      setTimeout(() => this.openDialog('onboarding'), SCHEDULE.ONBOARDING_DELAY_MS);
    } else if (isActiveHours()) {
      // Returning user: say hello shortly after launch so they see it works.
      this.scheduler.scheduleIn(SCHEDULE.GREETING_DELAY_MS);
      setTimeout(() => this.scheduler.tick(), SCHEDULE.GREETING_DELAY_MS + 300);
    }

    // Re-check the moment the laptop wakes/unlocks so a due nudge isn't missed.
    for (const event of ['resume', 'unlock-screen']) {
      powerMonitor.on(event, () => this.scheduler.tick());
    }
  }

  /** Show the reminder now (if reminders are allowed) and restart the countdown. */
  remind() {
    if (!this.scheduler.canRemind()) return;
    this.scheduler.restart();

    // Re-read the name each time: at login the roaming profile may not have
    // been ready when settings were first loaded.
    this.store.reload();
    this.name = normalizeName(this.store.get('name', ''));

    positionPetWindow(this.pet);
    this.pet.showInactive(); // appear without stealing keyboard focus
    this.pet.setAlwaysOnTop(true, 'screen-saver');
    this.pet.webContents.send(CHANNELS.REMINDER_SHOW, {
      name: this.name,
      snoozeMin: SCHEDULE.SNOOZE_MIN,
    });
  }

  acknowledge() {
    this.scheduler.restart();
  }

  snooze() {
    this.scheduler.snooze(SCHEDULE.SNOOZE_MIN);
  }

  hidePet() {
    this.pet.hide();
  }

  setName(value) {
    this.name = normalizeName(value);
    this.store.set({ name: this.name });
    this.tray.refresh();
    return this.name;
  }

  setInterval(value) {
    const minutes = normalizeInterval(value);
    this.store.set({ intervalMin: minutes });
    this.scheduler.setIntervalMinutes(minutes);
    return minutes;
  }

  setPaused(paused) {
    this.scheduler.setPaused(paused);
    if (paused) this.hidePet();
  }

  /** Tell the pet window to reload sprites after a successful character change. */
  afterSpriteChange(ok) {
    if (ok && !this.pet.isDestroyed()) this.pet.webContents.send(CHANNELS.SPRITES_CHANGED);
    return ok;
  }

  openDialog(key) {
    const { page, ...spec } = DIALOGS[key];
    const onClosed =
      key === 'onboarding'
        ? () => setTimeout(() => this.remind(), SCHEDULE.POST_ONBOARDING_DELAY_MS)
        : undefined;
    this.dialogs.show(page, { ...spec, onClosed });
  }

  quit() {
    this.quitting = true;
    app.quit();
  }

  /** @returns {import('./tray').TrayController} */
  trayController() {
    return {
      getName: () => this.name,
      getIntervalMin: () => this.scheduler.intervalMin,
      isPaused: () => this.scheduler.paused,
      minutesUntilNext: () => this.scheduler.minutesUntilNext(),
      remindNow: () => this.remind(),
      openOnboarding: () => this.openDialog('onboarding'),
      openName: () => this.openDialog('name'),
      openInterval: () => this.openDialog('interval'),
      openCharacter: () => this.openDialog('character'),
      setInterval: (m) => this.setInterval(m),
      setPaused: (p) => this.setPaused(p),
      quit: () => this.quit(),
    };
  }
}

function main() {
  // Pin the settings folder to the product name in dev and packaged builds alike.
  app.setName(APP_NAME);
  app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  let pingo = null;
  app.on('second-instance', () => pingo?.remind());

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
