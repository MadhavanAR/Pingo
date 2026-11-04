'use strict';

const path = require('node:path');
const { app, BrowserWindow, nativeTheme, screen, shell } = require('electron');
const { PRELOAD_PATH, RENDERER_DIR, PET_WINDOW } = require('./config');
const { CHANNELS } = require('../shared/channels');

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
function bringToFront(win, { pinned = true } = {}) {
  if (!win || win.isDestroyed()) return;
  // Without a Dock icon macOS won't activate the app by itself, and the window
  // would open without keyboard focus.
  if (process.platform === 'darwin') app.focus({ steal: true });
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.focus();
  win.moveTop();
  // Big windows people work in shouldn't float over everything once they're up.
  if (!pinned) setTimeout(() => !win.isDestroyed() && win.setAlwaysOnTop(false), 400);
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
    // The window never takes focus when it appears, so the first click on Done
    // must count instead of only activating the window.
    acceptFirstMouse: true,
    // Keep the walk and the auto-snooze on time behind other windows.
    webPreferences: { ...SECURE_WEB_PREFERENCES, backgroundThrottling: false },
  });
  lockDown(win);
  win.setAlwaysOnTop(true, 'screen-saver');
  // Also over fullscreen apps, or a due reminder would wait unseen on another space.
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
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

/**
 * Pin the pet window to a bottom corner of the chosen display, scaled to the
 * user's size setting (the page applies the same factor as CSS zoom; Electron's
 * own zoom is per-origin and would leak into the other windows).
 *
 * @param {BrowserWindow} win
 * @param {{ side: 'left' | 'right', screen: 'primary' | 'cursor', size: number }} appearance
 */
function positionPetWindow(win, { side, screen: which, size }) {
  const display =
    which === 'cursor'
      ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      : screen.getPrimaryDisplay();
  const { workArea } = display;
  const zoom = size / 100;
  const width = Math.round(PET_WINDOW.WIDTH * zoom);
  const height = Math.round(PET_WINDOW.HEIGHT * zoom);
  const x =
    side === 'left'
      ? workArea.x + PET_WINDOW.EDGE_MARGIN
      : workArea.x + workArea.width - width - PET_WINDOW.EDGE_MARGIN;
  win.setBounds({
    x,
    y: workArea.y + workArea.height - height - PET_WINDOW.EDGE_MARGIN,
    width,
    height,
  });
}

const windowBackground = () => (nativeTheme.shouldUseDarkColors ? '#111111' : '#ffffff');

/**
 * The control center and the onboarding wizard. Each is a singleton: opening
 * one that already exists just brings it forward.
 */
class DialogManager {
  constructor() {
    /** @type {Map<string, BrowserWindow>} */
    this.open = new Map();
  }

  /**
   * @param {string} page renderer HTML file name, also the singleton key
   * @param {object} spec
   * @param {string} spec.title
   * @param {number} spec.width
   * @param {number} spec.height
   * @param {number} [spec.minWidth] makes the window resizable down to this size
   * @param {number} [spec.minHeight]
   * @param {string} [spec.hash] route inside the page, e.g. "reminders"
   * @param {() => void} [spec.onClosed]
   */
  show(page, { title, width, height, minWidth, minHeight, hash = '', onClosed }) {
    const resizable = Boolean(minWidth);
    const existing = this.open.get(page);
    if (existing && !existing.isDestroyed()) {
      if (hash) existing.webContents.send(CHANNELS.APP_NAVIGATE, hash);
      bringToFront(existing, { pinned: !resizable });
      return existing;
    }
    const win = new BrowserWindow({
      width,
      height,
      minWidth,
      minHeight,
      title,
      show: false,
      resizable,
      minimizable: resizable,
      maximizable: resizable,
      fullscreenable: false,
      alwaysOnTop: !resizable,
      // The control center draws its own sidebar under the macOS traffic lights.
      ...(resizable && process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
      backgroundColor: windowBackground(),
      webPreferences: SECURE_WEB_PREFERENCES,
    });
    lockDown(win);
    // A dead page is a blank window; close it so the next open starts fresh.
    win.webContents.on('render-process-gone', () => !win.isDestroyed() && win.destroy());
    win.setMenuBarVisibility(false);
    win.loadFile(path.join(RENDERER_DIR, page), { hash });
    win.once('ready-to-show', () => {
      win.center();
      bringToFront(win, { pinned: !resizable });
    });
    win.on('closed', () => {
      this.open.delete(page);
      onClosed?.();
    });
    this.open.set(page, win);
    return win;
  }

  /** Tell every open dialog that app state changed, so it can re-render. */
  broadcast(channel) {
    for (const win of this.open.values()) {
      if (!win.isDestroyed()) win.webContents.send(channel);
    }
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
