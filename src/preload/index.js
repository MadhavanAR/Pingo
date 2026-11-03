'use strict';

/**
 * The only bridge between renderer pages and the main process.
 *
 * Runs sandboxed, so it cannot `require` local modules: channel names are
 * duplicated from `src/shared/channels.js` and kept in sync by
 * `test/channels.test.js`.
 */
const { contextBridge, ipcRenderer } = require('electron');

const send = (channel, ...args) => ipcRenderer.send(channel, ...args);
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const subscribe = (channel, cb) => {
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('pingo', {
  // Reminder popup
  onShow: (cb) => subscribe('reminder:show', (payload) => cb(payload ?? {})),
  done: () => send('reminder:done'),
  snooze: () => send('reminder:snooze'),
  hide: () => send('reminder:hide'),

  // App state: settings, reminders, what's next, today's counts
  getState: () => invoke('state:get'),
  onStateChanged: (cb) => subscribe('state:changed', () => cb()),
  onNavigate: (cb) => subscribe('app:navigate', (route) => cb(String(route ?? ''))),
  openApp: (route) => send('app:open', route),
  saveSettings: (patch) => invoke('settings:save', patch),
  setPaused: (minutes) => invoke('pause:set', minutes),
  setOpenAtLogin: (on) => invoke('login:set', on),

  // Reminders (any subset of fields; returns the saved, validated reminder)
  saveReminder: (reminder) => invoke('reminder:save', reminder),
  deleteReminder: (id) => invoke('reminder:delete', id),
  previewReminder: (reminder) => invoke('reminder:preview', reminder),

  // Characters: bundled ones and the user's own avatars
  getAvatars: () => invoke('avatars:get'),
  getAvatar: (id) => invoke('avatar:get', id),
  saveAvatar: (avatar) => invoke('avatar:save', avatar),
  deleteAvatar: (id) => invoke('avatar:delete', id),
  selectAvatar: (key) => invoke('avatar:select', key),
  pickImage: () => invoke('dialog:pickImage'),

  // First-run onboarding
  closeOnboarding: () => send('onboarding:close'),
});
