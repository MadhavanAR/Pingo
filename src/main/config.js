'use strict';

const path = require('node:path');

/** Static app configuration. Per-user settings live in `store.js` instead. */

const APP_NAME = 'Pingo';

/** Earlier names' user-data folders, newest first; migrated once on first launch. */
const LEGACY_USER_DATA_DIRS = Object.freeze(['Nudgy', 'Hydrate Buddy', 'hydrate-buddy']);

const ROOT_DIR = path.join(__dirname, '..', '..');
const RENDERER_DIR = path.join(ROOT_DIR, 'src', 'renderer');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PRELOAD_PATH = path.join(ROOT_DIR, 'src', 'preload', 'index.js');

const MINUTE_MS = 60_000;

const SCHEDULE = Object.freeze({
  TIME_ZONE: 'Asia/Kolkata', // reminders follow IST regardless of the machine's zone
  ACTIVE_START_HOUR: 10, // first hour reminders may appear
  ACTIVE_END_HOUR: 23, // reminders stop at 23:00
  DEFAULT_INTERVAL_MIN: 45, // used until the user picks their own
  MAX_INTERVAL_MIN: 720, // 12 hours
  INTERVAL_OPTIONS: Object.freeze([15, 30, 45, 60, 90]), // tray menu presets
  SNOOZE_MIN: 10,
  GREETING_DELAY_MS: 6000, // first hello after launch, so you can see it work
  ONBOARDING_DELAY_MS: 1500,
  POST_ONBOARDING_DELAY_MS: 800,
  TICK_MS: 30_000, // short poll so reminders survive sleep/wake
});

const PET_WINDOW = Object.freeze({ WIDTH: 360, HEIGHT: 430, EDGE_MARGIN: 8 });

const NAME_MAX_LENGTH = 24;

/** Upper bound on a single custom sprite, to stop a renderer flooding the disk. */
const MAX_SPRITE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']);

const POSE_NAMES = Object.freeze([
  'idle',
  'walking',
  'typing',
  'think',
  'wave',
  'point',
  'drink',
  'happy',
  'stretch',
  'working',
  'rest',
]);

const CUSTOM_CHARACTER = 'custom';
const DEFAULT_CHARACTER = 'boy';

/**
 * Bundled characters, one PNG per pose in assets/characters/<key>/. Poses a
 * character lacks fall back to its wave or idle sprite. Each needs idle.png
 * (gallery thumbnail) and drink.png. Sources and slicing layouts live in raw/.
 */
const preset = (key, label) =>
  Object.freeze({
    key,
    label,
    idle: path.join(ASSETS_DIR, 'characters', key, 'idle.png'),
    drinking: path.join(ASSETS_DIR, 'characters', key, 'drink.png'),
    posesDir: path.join(ASSETS_DIR, 'characters', key),
  });

const PRESETS = Object.freeze([
  preset('boy', 'Classic'),
  preset('boy-badge', 'ID badge'),
  preset('boy-sticker', 'Sticker'),
]);

module.exports = {
  APP_NAME,
  LEGACY_USER_DATA_DIRS,
  ROOT_DIR,
  RENDERER_DIR,
  ASSETS_DIR,
  PRELOAD_PATH,
  MINUTE_MS,
  SCHEDULE,
  PET_WINDOW,
  NAME_MAX_LENGTH,
  MAX_SPRITE_BYTES,
  IMAGE_EXTENSIONS,
  POSE_NAMES,
  CUSTOM_CHARACTER,
  DEFAULT_CHARACTER,
  PRESETS,
};
