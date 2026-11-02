'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PRESETS,
  POSE_NAMES,
  CUSTOM_CHARACTER,
  DEFAULT_CHARACTER,
  MAX_SPRITE_BYTES,
} = require('./config');
const { dataUrlToBuffer } = require('./validation');

const CUSTOM_SLOTS = ['idle', 'drinking'];

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
};

function fileToDataUrl(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null;
  try {
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}

function isKnownCharacter(key) {
  return key === CUSTOM_CHARACTER || PRESETS.some((p) => p.key === key);
}

/**
 * Bundled presets plus the user's own imported sprites (stored in the
 * user-data folder).
 */
class Characters {
  /**
   * @param {object} deps
   * @param {string} deps.userDataDir where custom sprites are written
   * @param {import('./store').Store} deps.store
   * @param {Pick<Console, 'error'>} [deps.logger]
   */
  constructor({ userDataDir, store, logger = console }) {
    this.userDataDir = userDataDir;
    this.store = store;
    this.logger = logger;
  }

  customSpriteFile(slot) {
    return path.join(this.userDataDir, `custom-${slot}.png`);
  }

  hasCustom() {
    return CUSTOM_SLOTS.every((slot) => fs.existsSync(this.customSpriteFile(slot)));
  }

  activeKey() {
    const key = this.store.get('character');
    // Older configs may still name a character that's no longer bundled.
    return isKnownCharacter(key) ? key : DEFAULT_CHARACTER;
  }

  /** @returns {boolean} false when `key` is not a known character */
  select(key) {
    if (!isKnownCharacter(key)) return false;
    if (key === CUSTOM_CHARACTER && !this.hasCustom()) return false;
    this.store.set({ character: key });
    return true;
  }

  /** Persist the user's own idle + drinking sprites and make them active. */
  saveCustom(idleDataUrl, drinkingDataUrl) {
    const buffers = {
      idle: dataUrlToBuffer(idleDataUrl, MAX_SPRITE_BYTES),
      drinking: dataUrlToBuffer(drinkingDataUrl, MAX_SPRITE_BYTES),
    };
    if (!buffers.idle || !buffers.drinking) return false;
    try {
      fs.mkdirSync(this.userDataDir, { recursive: true });
      for (const slot of CUSTOM_SLOTS) fs.writeFileSync(this.customSpriteFile(slot), buffers[slot]);
    } catch (err) {
      this.logger.error('Failed to save custom character:', err);
      return false;
    }
    return this.store.set({ character: CUSTOM_CHARACTER });
  }

  resetCustom() {
    for (const slot of CUSTOM_SLOTS) {
      try {
        fs.rmSync(this.customSpriteFile(slot), { force: true });
      } catch (err) {
        this.logger.error('Failed to remove custom sprite:', err);
      }
    }
    return this.store.set({ character: DEFAULT_CHARACTER });
  }

  /** Gallery data for the character pickers. */
  presetsInfo() {
    return {
      active: this.activeKey(),
      hasCustom: this.hasCustom(),
      presets: PRESETS.map((p) => ({ key: p.key, label: p.label, thumb: fileToDataUrl(p.idle) })),
    };
  }

  /** Sprites (as data URLs) for whichever character is active. */
  activeSprites() {
    const key = this.activeKey();
    if (key === CUSTOM_CHARACTER && this.hasCustom()) {
      return {
        idle: fileToDataUrl(this.customSpriteFile('idle')),
        drinking: fileToDataUrl(this.customSpriteFile('drinking')),
      };
    }
    const preset = PRESETS.find((p) => p.key === key) ?? PRESETS[0];
    const sprites = { idle: fileToDataUrl(preset.idle), drinking: fileToDataUrl(preset.drinking) };
    if (preset.posesDir) {
      sprites.poses = {};
      for (const name of POSE_NAMES) {
        const url = fileToDataUrl(path.join(preset.posesDir, `${name}.png`));
        if (url) sprites.poses[name] = url;
      }
    }
    return sprites;
  }
}

module.exports = { Characters, fileToDataUrl, isKnownCharacter };
