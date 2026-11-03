'use strict';

const { pathToFileURL } = require('node:url');
const { ipcMain, dialog, BrowserWindow } = require('electron');
const { CHANNELS } = require('../shared/channels');
const { RENDERER_DIR, IMAGE_EXTENSIONS } = require('./config');
const { fileToDataUrl } = require('./characters');

const RENDERER_URL_PREFIX = (pathToFileURL(RENDERER_DIR).href + '/').toLowerCase();

/** Only accept IPC from our own bundled pages, never from remote content. */
function isTrustedSender(event) {
  const url = event.senderFrame?.url ?? '';
  // Case-insensitive: Windows drive letters may differ in case between APIs.
  return url.toLowerCase().startsWith(RENDERER_URL_PREFIX);
}

function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Blocked IPC "${channel}" from untrusted sender`);
    return fn(...args, event);
  });
}

function on(channel, fn) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) fn(...args);
  });
}

/**
 * Wire renderer requests to the app controller.
 *
 * @param {object} ctx
 * @param {import('./index').PingoApp} ctx.pingo
 */
function registerIpc({ pingo }) {
  const { characters, dialogs } = pingo;

  // Reminder popup
  on(CHANNELS.REMINDER_DONE, () => pingo.done());
  on(CHANNELS.REMINDER_SNOOZE, () => pingo.snooze());
  on(CHANNELS.REMINDER_HIDE, () => pingo.hidePet());

  // App state and settings
  handle(CHANNELS.STATE_GET, () => pingo.state());
  handle(CHANNELS.SETTINGS_SAVE, (patch) => pingo.updateSettings(patch));
  handle(CHANNELS.PAUSE_SET, (minutes) => pingo.setPaused(minutes));
  handle(CHANNELS.LOGIN_SET, (enabled) => pingo.setOpenAtLogin(enabled === true));
  on(CHANNELS.APP_OPEN, (route) => pingo.openApp(typeof route === 'string' ? route : ''));
  on(CHANNELS.ONBOARDING_CLOSE, () => dialogs.close('onboarding.html'));

  // Reminders
  handle(CHANNELS.REMINDER_SAVE, (reminder) => pingo.saveReminder(reminder));
  handle(CHANNELS.REMINDER_DELETE, (id) => pingo.deleteReminder(id));
  handle(CHANNELS.REMINDER_PREVIEW, (draft) => pingo.previewReminder(draft));

  // Characters
  handle(CHANNELS.AVATARS_GET, () => characters.list());
  handle(CHANNELS.AVATAR_GET, (id) => characters.getCustom(id));
  handle(CHANNELS.AVATAR_SAVE, (avatar) => pingo.changed(characters.saveCustom(avatar)));
  handle(CHANNELS.AVATAR_DELETE, (id) => pingo.changed(characters.deleteCustom(id)));
  handle(CHANNELS.AVATAR_SELECT, (key) => pingo.changed(characters.select(key)));
  handle(CHANNELS.DIALOG_PICK_IMAGE, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const res = await dialog.showOpenDialog(parent, {
      title: 'Choose an image or GIF',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return fileToDataUrl(res.filePaths[0]);
  });
}

module.exports = { registerIpc, isTrustedSender };
