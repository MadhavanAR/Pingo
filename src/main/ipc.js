'use strict';

const { pathToFileURL } = require('node:url');
const { ipcMain, dialog } = require('electron');
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
    return fn(...args);
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
  on(CHANNELS.REMINDER_YES, () => pingo.acknowledge());
  on(CHANNELS.REMINDER_SNOOZE, () => pingo.snooze());
  on(CHANNELS.REMINDER_HIDE, () => pingo.hidePet());

  // Name
  handle(CHANNELS.NAME_GET, () => pingo.name);
  handle(CHANNELS.NAME_SAVE, (value) => pingo.setName(value));
  on(CHANNELS.NAME_CLOSE, () => dialogs.close('name.html'));

  // Interval
  handle(CHANNELS.INTERVAL_GET, () => pingo.scheduler.intervalMin);
  handle(CHANNELS.INTERVAL_SAVE, (value) => pingo.setInterval(value));
  on(CHANNELS.INTERVAL_CLOSE, () => dialogs.close('interval.html'));

  on(CHANNELS.ONBOARDING_CLOSE, () => dialogs.close('onboarding.html'));

  // Characters
  handle(CHANNELS.DIALOG_PICK_IMAGE, async () => {
    const parent = dialogs.get('character.html') ?? undefined;
    const res = await dialog.showOpenDialog(parent, {
      title: 'Choose a character image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return fileToDataUrl(res.filePaths[0]);
  });
  handle(CHANNELS.CHARACTER_SAVE, (idle, drinking) =>
    pingo.afterSpriteChange(characters.saveCustom(idle, drinking)),
  );
  handle(CHANNELS.CHARACTER_RESET, () => pingo.afterSpriteChange(characters.resetCustom()));
  handle(CHANNELS.CHARACTER_SELECT, (key) => pingo.afterSpriteChange(characters.select(key)));
  handle(CHANNELS.CHARACTER_HAS_CUSTOM, () => characters.hasCustom());
  handle(CHANNELS.PRESETS_GET, () => characters.presetsInfo());
  handle(CHANNELS.SPRITES_GET, () => characters.activeSprites());
  on(CHANNELS.CHARACTER_CLOSE, () => dialogs.close('character.html'));
}

module.exports = { registerIpc, isTrustedSender };
