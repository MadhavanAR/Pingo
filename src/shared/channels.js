'use strict';

/**
 * Single source of truth for IPC channel names.
 *
 * The sandboxed preload cannot `require` local files, so it keeps its own copy
 * of these strings; `test/channels.test.js` fails if the two ever drift apart.
 */
const CHANNELS = Object.freeze({
  // main -> renderer
  REMINDER_SHOW: 'reminder:show',
  STATE_CHANGED: 'state:changed',
  APP_NAVIGATE: 'app:navigate',

  // renderer -> main (fire-and-forget)
  REMINDER_DONE: 'reminder:done',
  REMINDER_SNOOZE: 'reminder:snooze',
  REMINDER_HIDE: 'reminder:hide',
  ONBOARDING_CLOSE: 'onboarding:close',
  APP_OPEN: 'app:open',

  // renderer -> main (request/response)
  STATE_GET: 'state:get',
  SETTINGS_SAVE: 'settings:save',
  REMINDER_SAVE: 'reminder:save',
  REMINDER_DELETE: 'reminder:delete',
  REMINDER_PREVIEW: 'reminder:preview',
  AVATARS_GET: 'avatars:get',
  AVATAR_GET: 'avatar:get',
  AVATAR_SAVE: 'avatar:save',
  AVATAR_DELETE: 'avatar:delete',
  AVATAR_SELECT: 'avatar:select',
  DIALOG_PICK_IMAGE: 'dialog:pickImage',
  PAUSE_SET: 'pause:set',
  LOGIN_SET: 'login:set',
});

/** Channels the main process sends; every other channel is handled in ipc.js. */
const MAIN_TO_RENDERER = Object.freeze(['REMINDER_SHOW', 'STATE_CHANGED', 'APP_NAVIGATE']);

module.exports = { CHANNELS, MAIN_TO_RENDERER };
