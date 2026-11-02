'use strict';

const path = require('node:path');
const { app, Menu, Tray, nativeImage } = require('electron');
const { APP_NAME, ASSETS_DIR, SCHEDULE } = require('./config');

/**
 * System-tray icon and menu. Owns no state of its own: it renders whatever the
 * controller reports and forwards clicks back to it.
 *
 * @typedef {object} TrayController
 * @property {() => string} getName
 * @property {() => number} getIntervalMin
 * @property {() => boolean} isPaused
 * @property {() => number} minutesUntilNext
 * @property {() => void} remindNow
 * @property {() => void} openOnboarding
 * @property {() => void} openName
 * @property {() => void} openInterval
 * @property {() => void} openCharacter
 * @property {(minutes: number) => void} setInterval
 * @property {(paused: boolean) => void} setPaused
 * @property {() => void} quit
 */
class AppTray {
  /** @param {TrayController} controller */
  constructor(controller) {
    this.controller = controller;
    const icon = nativeImage.createFromPath(path.join(ASSETS_DIR, 'tray.png'));
    this.tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    this.tray.on('click', () => controller.remindNow());
    this.refresh();
  }

  /** Rebuild menu + tooltip after any state change. */
  refresh() {
    this.tray.setContextMenu(Menu.buildFromTemplate(this.buildTemplate()));
    this.tray.setToolTip(this.tooltip());
  }

  tooltip() {
    const c = this.controller;
    if (c.isPaused()) return `${APP_NAME} — paused`;
    return `${APP_NAME} — next nudge in ~${c.minutesUntilNext()} min`;
  }

  buildTemplate() {
    const c = this.controller;
    const name = c.getName();
    const intervalMin = c.getIntervalMin();

    const template = [
      { label: 'Drink now 💧', click: () => c.remindNow() },
      { label: 'Set up…', click: () => c.openOnboarding() },
      { type: 'separator' },
      { label: name ? `Set your name… (${name})` : 'Set your name…', click: () => c.openName() },
      {
        label: `Reminder every ${intervalMin} min`,
        submenu: [
          ...SCHEDULE.INTERVAL_OPTIONS.map((m) => ({
            label: `${m} minutes`,
            type: 'radio',
            checked: intervalMin === m,
            click: () => c.setInterval(m),
          })),
          { type: 'separator' },
          {
            label: 'Custom…',
            type: 'radio',
            checked: !SCHEDULE.INTERVAL_OPTIONS.includes(intervalMin),
            click: () => c.openInterval(),
          },
        ],
      },
      { label: 'Change character…', click: () => c.openCharacter() },
      {
        label: 'Pause reminders',
        type: 'checkbox',
        checked: c.isPaused(),
        click: (item) => c.setPaused(item.checked),
      },
    ];

    // Installed builds get a native "start at login" toggle.
    // (In dev, use `npm run autostart:enable` instead.)
    if (app.isPackaged) {
      template.push({
        label: 'Start at login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      });
    }

    template.push({ type: 'separator' }, { label: `Quit ${APP_NAME}`, click: () => c.quit() });
    return template;
  }
}

module.exports = { AppTray };
