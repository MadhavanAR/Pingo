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
  SPRITES_CHANGED: 'sprites:changed',

  // renderer -> main (fire-and-forget)
  REMINDER_YES: 'reminder:yes',
  REMINDER_SNOOZE: 'reminder:snooze',
  REMINDER_HIDE: 'reminder:hide',
  NAME_CLOSE: 'name:close',
  INTERVAL_CLOSE: 'interval:close',
  ONBOARDING_CLOSE: 'onboarding:close',
  CHARACTER_CLOSE: 'character:close',

  // renderer -> main (request/response)
  NAME_GET: 'name:get',
  NAME_SAVE: 'name:save',
  INTERVAL_GET: 'interval:get',
  INTERVAL_SAVE: 'interval:save',
  DIALOG_PICK_IMAGE: 'dialog:pickImage',
  CHARACTER_SAVE: 'character:save',
  CHARACTER_RESET: 'character:reset',
  CHARACTER_SELECT: 'character:select',
  CHARACTER_HAS_CUSTOM: 'character:hasCustom',
  PRESETS_GET: 'presets:get',
  SPRITES_GET: 'sprites:get',
});

module.exports = { CHANNELS };
