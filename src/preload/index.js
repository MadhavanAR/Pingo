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
  yes: () => send('reminder:yes'),
  snooze: () => send('reminder:snooze'),
  hide: () => send('reminder:hide'),

  // Name
  getName: () => invoke('name:get'),
  saveName: (value) => invoke('name:save', value),
  closeNameWindow: () => send('name:close'),

  // Reminder interval
  getInterval: () => invoke('interval:get'),
  saveInterval: (value) => invoke('interval:save', value),
  closeIntervalWindow: () => send('interval:close'),

  // First-run onboarding
  closeOnboarding: () => send('onboarding:close'),

  // Character gallery + custom import
  getPresets: () => invoke('presets:get'),
  selectCharacter: (key) => invoke('character:select', key),
  pickImage: () => invoke('dialog:pickImage'),
  saveCharacter: (idle, drinking) => invoke('character:save', idle, drinking),
  resetCharacter: () => invoke('character:reset'),
  hasCustomCharacter: () => invoke('character:hasCustom'),
  getSprites: () => invoke('sprites:get'),
  onSpritesChanged: (cb) => subscribe('sprites:changed', () => cb()),
  closeCharacterWindow: () => send('character:close'),
});
