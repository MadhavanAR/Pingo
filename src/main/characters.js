'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PRESETS,
  POSE_NAMES,
  CUSTOM_PREFIX,
  DEFAULT_CHARACTER,
  MAX_SPRITE_BYTES,
  MAX_CUSTOM_AVATARS,
} = require('./config');
const { parseImageDataUrl } = require('./validation');
const { cleanText, wholeNumber } = require('./settings');
const { newId } = require('./reminders');

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
};

const SLOTS = Object.freeze(['idle', 'celebrate']);
const LABEL_MAX_LENGTH = 24;
const SCALE = Object.freeze({ MIN: 50, MAX: 160, DEFAULT: 100 });

/** Avatar files are only ever names we wrote ourselves, inside avatars/. */
const isAvatarFile = (v) =>
  typeof v === 'string' && /^[a-z0-9]+-(idle|celebrate)\.(png|gif|webp|jpg)$/.test(v);

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

const presetFor = (key) => PRESETS.find((p) => p.key === key) ?? null;

/**
 * Bundled presets plus any number of the user's own avatars (any image or an
 * animated GIF, stored in the user-data folder).
 *
 * Keys: a preset's key ("boy"), or "custom:<id>" for a user's avatar.
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
    this.avatarsDir = path.join(userDataDir, 'avatars');
    this.store = store;
    this.logger = logger;
  }

  /** Version 2 kept one custom character as custom-idle.png + custom-drinking.png. */
  migrateLegacy() {
    if (this.store.get('customAvatars') !== undefined) return;
    const idle = path.join(this.userDataDir, 'custom-idle.png');
    const drinking = path.join(this.userDataDir, 'custom-drinking.png');
    const avatars = [];
    try {
      if (fs.existsSync(idle)) {
        fs.mkdirSync(this.avatarsDir, { recursive: true });
        fs.copyFileSync(idle, path.join(this.avatarsDir, 'legacy-idle.png'));
        const hasDrinking = fs.existsSync(drinking);
        if (hasDrinking) {
          fs.copyFileSync(drinking, path.join(this.avatarsDir, 'legacy-celebrate.png'));
        }
        avatars.push({
          id: 'legacy',
          label: 'My character',
          idle: 'legacy-idle.png',
          celebrate: hasDrinking ? 'legacy-celebrate.png' : null,
          flip: false,
          scale: SCALE.DEFAULT,
        });
      }
    } catch (err) {
      this.logger.error('Could not migrate the custom character:', err);
    }
    const patch = { customAvatars: avatars };
    if (this.store.get('character') === 'custom') {
      patch.character = avatars.length ? `${CUSTOM_PREFIX}legacy` : DEFAULT_CHARACTER;
    }
    this.store.set(patch);
  }

  /** Stored custom avatars, validated, keeping only those whose image exists. */
  customAvatars() {
    const list = this.store.get('customAvatars', []);
    if (!Array.isArray(list)) return [];
    return list
      .filter((a) => a && /^[a-z0-9]{1,24}$/.test(a.id) && isAvatarFile(a.idle))
      .filter((a) => fs.existsSync(path.join(this.avatarsDir, a.idle)))
      .map((a) => ({
        id: a.id,
        label: cleanText(a.label, LABEL_MAX_LENGTH) || 'My avatar',
        idle: a.idle,
        celebrate: isAvatarFile(a.celebrate) ? a.celebrate : null,
        flip: a.flip === true,
        scale: wholeNumber(a.scale, { min: SCALE.MIN, max: SCALE.MAX, fallback: SCALE.DEFAULT }),
      }));
  }

  customById(id) {
    return this.customAvatars().find((a) => a.id === id) ?? null;
  }

  customIdFromKey(key) {
    return typeof key === 'string' && key.startsWith(CUSTOM_PREFIX)
      ? key.slice(CUSTOM_PREFIX.length)
      : null;
  }

  isKnown(key) {
    if (presetFor(key)) return true;
    const id = this.customIdFromKey(key);
    return Boolean(id && this.customById(id));
  }

  /** The character used by reminders that don't pick their own. */
  defaultKey() {
    const key = this.store.get('character');
    // Older configs may still name a character that's no longer bundled.
    return this.isKnown(key) ? key : DEFAULT_CHARACTER;
  }

  /** `key` if it still exists, otherwise the default character. */
  resolve(key) {
    return key && this.isKnown(key) ? key : this.defaultKey();
  }

  /** @returns {boolean} false when `key` is not a known character */
  select(key) {
    if (!this.isKnown(key)) return false;
    return this.store.set({ character: key });
  }

  /** Gallery data for the pickers: every character with a thumbnail. */
  list() {
    const presets = PRESETS.map((p) => ({
      key: p.key,
      label: p.label,
      kind: 'preset',
      thumb: fileToDataUrl(p.idle),
      animated: false,
    }));
    const customs = this.customAvatars().map((a) => ({
      key: `${CUSTOM_PREFIX}${a.id}`,
      id: a.id,
      label: a.label,
      kind: 'custom',
      thumb: fileToDataUrl(path.join(this.avatarsDir, a.idle)),
      animated: a.idle.endsWith('.gif') || a.idle.endsWith('.webp'),
      hasCelebrate: Boolean(a.celebrate),
      flip: a.flip,
      scale: a.scale,
    }));
    return { defaultKey: this.defaultKey(), avatars: [...presets, ...customs] };
  }

  /** One custom avatar with its images, for editing in the studio. */
  getCustom(id) {
    const a = this.customById(id);
    if (!a) return null;
    return {
      ...a,
      key: `${CUSTOM_PREFIX}${a.id}`,
      idle: fileToDataUrl(path.join(this.avatarsDir, a.idle)),
      celebrate: a.celebrate ? fileToDataUrl(path.join(this.avatarsDir, a.celebrate)) : null,
    };
  }

  writeSlot(id, slot, dataUrl, previous) {
    const image = parseImageDataUrl(dataUrl, MAX_SPRITE_BYTES);
    if (!image) return undefined;
    const name = `${id}-${slot}.${image.ext}`;
    fs.writeFileSync(path.join(this.avatarsDir, name), image.buffer);
    if (previous && previous !== name) {
      fs.rmSync(path.join(this.avatarsDir, previous), { force: true });
    }
    return name;
  }

  /**
   * Create or update a custom avatar. Image fields are data URLs; leave one
   * out to keep the current image, or pass `celebrate: null` to remove it.
   *
   * @returns {string | null} the avatar's key, or null if nothing was saved
   */
  saveCustom(patch) {
    if (!patch || typeof patch !== 'object') return null;
    const list = this.customAvatars();
    const existing = list.find((a) => a.id === patch.id) ?? null;
    if (!existing && list.length >= MAX_CUSTOM_AVATARS) return null;
    if (!existing && typeof patch.idle !== 'string') return null;

    const id = existing?.id ?? newId();
    const avatar = existing
      ? { ...existing }
      : { id, label: 'My avatar', idle: null, celebrate: null, flip: false, scale: SCALE.DEFAULT };
    if (Object.hasOwn(patch, 'label')) {
      avatar.label = cleanText(patch.label, LABEL_MAX_LENGTH) || 'My avatar';
    }
    if (Object.hasOwn(patch, 'flip')) avatar.flip = patch.flip === true;
    if (Object.hasOwn(patch, 'scale')) {
      avatar.scale = wholeNumber(patch.scale, {
        min: SCALE.MIN,
        max: SCALE.MAX,
        fallback: SCALE.DEFAULT,
      });
    }

    try {
      fs.mkdirSync(this.avatarsDir, { recursive: true });
      for (const slot of SLOTS) {
        if (!Object.hasOwn(patch, slot)) continue;
        if (slot === 'celebrate' && patch.celebrate === null) {
          if (avatar.celebrate) {
            fs.rmSync(path.join(this.avatarsDir, avatar.celebrate), { force: true });
          }
          avatar.celebrate = null;
          continue;
        }
        const name = this.writeSlot(id, slot, patch[slot], avatar[slot]);
        if (name === undefined) return null; // not a real image
        avatar[slot] = name;
      }
    } catch (err) {
      this.logger.error('Failed to save avatar:', err);
      return null;
    }

    const next = existing ? list.map((a) => (a.id === id ? avatar : a)) : [...list, avatar];
    if (!this.store.set({ customAvatars: next })) return null;
    return `${CUSTOM_PREFIX}${id}`;
  }

  deleteCustom(id) {
    const avatar = this.customById(id);
    if (!avatar) return false;
    for (const file of [avatar.idle, avatar.celebrate]) {
      if (!file) continue;
      try {
        fs.rmSync(path.join(this.avatarsDir, file), { force: true });
      } catch (err) {
        this.logger.error('Failed to remove avatar image:', err);
      }
    }
    const patch = { customAvatars: this.customAvatars().filter((a) => a.id !== id) };
    if (this.store.get('character') === `${CUSTOM_PREFIX}${id}`) {
      patch.character = DEFAULT_CHARACTER;
    }
    return this.store.set(patch);
  }

  /** Sprites (as data URLs) for `key`, falling back to the default character. */
  sprites(key) {
    const resolved = this.resolve(key);
    const id = this.customIdFromKey(resolved);
    if (id) {
      const a = this.customById(id);
      const idle = fileToDataUrl(path.join(this.avatarsDir, a.idle));
      return {
        key: resolved,
        kind: 'custom',
        idle,
        celebrate: a.celebrate ? fileToDataUrl(path.join(this.avatarsDir, a.celebrate)) : idle,
        flip: a.flip,
        scale: a.scale,
      };
    }
    const preset = presetFor(resolved) ?? PRESETS[0];
    const poses = {};
    for (const name of POSE_NAMES) {
      const url = fileToDataUrl(path.join(preset.posesDir, `${name}.png`));
      if (url) poses[name] = url;
    }
    return {
      key: preset.key,
      kind: 'preset',
      idle: fileToDataUrl(preset.idle),
      celebrate: fileToDataUrl(preset.drinking),
      poses,
      flip: false,
      scale: SCALE.DEFAULT,
    };
  }
}

module.exports = { Characters, fileToDataUrl, SCALE };
