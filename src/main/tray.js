'use strict';

const path = require('node:path');
const { app, Menu, Tray, nativeImage, shell } = require('electron');
const { APP_NAME, ASSETS_DIR, SCHEDULE, WEBSITE_URL } = require('./config');

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const duration = (minutes) =>
  minutes < 60 ? `${minutes} min` : `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;

/**
 * System-tray icon and menu. Owns no state of its own: it renders whatever the
 * controller reports and forwards clicks back to it.
 *
 * @typedef {object} TrayController
 * @property {() => ({ title: string, at: number, minutes: number } | null)} nextUp
 * @property {() => number} pausedUntil ms timestamp, Infinity, or 0 when running
 * @property {() => void} remindNow
 * @property {(route?: string) => void} openApp
 * @property {() => void} openOnboarding
 * @property {(minutes: number | 'tomorrow') => void} pause -1 pauses until resumed
 * @property {() => void} resume
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

  statusLine() {
    const c = this.controller;
    const until = c.pausedUntil();
    if (until === Infinity) return 'Paused';
    if (until) return `Paused until ${clock(until)}`;
    const next = c.nextUp();
    if (!next) return 'No reminders on';
    return `Next: ${next.title} at ${clock(next.at)}`;
  }

  tooltip() {
    return `${APP_NAME} — ${this.statusLine()}`;
  }

  buildTemplate() {
    const c = this.controller;
    const paused = c.pausedUntil() !== 0;

    const template = [
      { label: this.statusLine(), enabled: false },
      {
        label: 'Remind me now',
        enabled: !paused && c.nextUp() !== null,
        click: () => c.remindNow(),
      },
      { type: 'separator' },
      { label: `Open ${APP_NAME}…`, click: () => c.openApp('home') },
      { label: 'New reminder…', click: () => c.openApp('reminders/new') },
      { label: 'Avatars…', click: () => c.openApp('avatars') },
      { type: 'separator' },
      paused
        ? { label: 'Resume reminders', click: () => c.resume() }
        : {
            label: 'Pause',
            submenu: [
              ...SCHEDULE.PAUSE_OPTIONS_MIN.map((m) => ({
                label: `For ${duration(m)}`,
                click: () => c.pause(m),
              })),
              { label: 'Until tomorrow', click: () => c.pause('tomorrow') },
              { label: 'Until I resume', click: () => c.pause(-1) },
            ],
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

    template.push(
      { label: 'Run setup again…', click: () => c.openOnboarding() },
      { label: `${APP_NAME} website…`, click: () => shell.openExternal(WEBSITE_URL) },
      { type: 'separator' },
      { label: `Quit ${APP_NAME}`, click: () => c.quit() },
    );
    return template;
  }
}

module.exports = { AppTray };
