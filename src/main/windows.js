'use strict';

const path = require('node:path');
const { BrowserWindow, screen, shell } = require('electron');
const { PRELOAD_PATH, RENDERER_DIR, PET_WINDOW } = require('./config');

const SECURE_WEB_PREFERENCES = Object.freeze({
  preload: PRELOAD_PATH,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  spellcheck: false,
});

/** Our pages are local files; never let them navigate away or open new windows. */
function lockDown(win) {
  const { webContents } = win;
  webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  webContents.on('will-navigate', (event, url) => {
    if (url !== webContents.getURL()) event.preventDefault();
  });
}

/**
 * Force a window to the foreground. On Windows a tray app is otherwise
 * blocked from stealing focus, so the dialog would open behind other apps.
 */
function bringToFront(win) {
  if (!win || win.isDestroyed()) return;
  win.center();
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.focus();
  win.moveTop();
  if (process.platform === 'win32') {
    win.flashFrame(true);
    setTimeout(() => !win.isDestroyed() && win.flashFrame(false), 2500);
  }
}

/** The transparent, frameless window the character walks around in. */
function createPetWindow({ shouldHideOnClose }) {
  const win = new BrowserWindow({
    width: PET_WINDOW.WIDTH,
    height: PET_WINDOW.HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  lockDown(win);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(RENDERER_DIR, 'index.html'));

  // Closing the window just hides the character; quitting happens from the tray.
  win.on('close', (event) => {
    if (shouldHideOnClose()) {
      event.preventDefault();
      win.hide();
    }
  });
  return win;
}

/** Pin the pet window to the bottom-right corner of the primary display. */
function positionPetWindow(win) {
  const { workArea } = screen.getPrimaryDisplay();
  win.setBounds({
    x: workArea.x + workArea.width - PET_WINDOW.WIDTH - PET_WINDOW.EDGE_MARGIN,
    y: workArea.y + workArea.height - PET_WINDOW.HEIGHT - PET_WINDOW.EDGE_MARGIN,
    width: PET_WINDOW.WIDTH,
    height: PET_WINDOW.HEIGHT,
  });
}

/**
 * Small settings dialogs (name, interval, onboarding, character). Each is a
 * singleton: opening one that already exists just brings it forward.
 */
class DialogManager {
  constructor() {
    /** @type {Map<string, BrowserWindow>} */
    this.open = new Map();
  }

  /**
   * @param {string} page renderer HTML file name, also the singleton key
   * @param {{ title: string, width: number, height: number, onClosed?: () => void }} spec
   */
  show(page, { title, width, height, onClosed }) {
    const existing = this.open.get(page);
    if (existing && !existing.isDestroyed()) {
      bringToFront(existing);
      return existing;
    }
    const win = new BrowserWindow({
      width,
      height,
      title,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: SECURE_WEB_PREFERENCES,
    });
    lockDown(win);
    win.setMenuBarVisibility(false);
    win.loadFile(path.join(RENDERER_DIR, page));
    win.once('ready-to-show', () => bringToFront(win));
    win.on('closed', () => {
      this.open.delete(page);
      onClosed?.();
    });
    this.open.set(page, win);
    return win;
  }

  get(page) {
    const win = this.open.get(page);
    return win && !win.isDestroyed() ? win : null;
  }

  close(page) {
    this.get(page)?.close();
  }
}

module.exports = { createPetWindow, positionPetWindow, DialogManager };
