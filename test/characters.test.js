'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Characters } = require('../src/main/characters');
const { Store } = require('../src/main/store');
const { DEFAULT_CHARACTER, PRESETS, POSE_NAMES } = require('../src/main/config');

const silent = { error() {}, warn() {} };
const dataUrl = (bytes) => 'data:image/png;base64,' + Buffer.from(bytes).toString('base64');
const PNG = dataUrl([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const GIF = dataUrl(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(8)]));

function setup() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pingo-chars-'));
  const store = new Store(path.join(userDataDir, 'config.json'), { logger: silent });
  return { characters: new Characters({ userDataDir, store, logger: silent }), store, userDataDir };
}

test('defaults to the bundled character and ignores unknown keys', () => {
  const { characters, store } = setup();
  assert.equal(characters.defaultKey(), DEFAULT_CHARACTER);
  store.set({ character: 'retired-character' });
  assert.equal(characters.defaultKey(), DEFAULT_CHARACTER);
  assert.equal(characters.select('../../etc'), false);
  assert.equal(characters.select('custom:nope'), false);
  assert.equal(characters.resolve('custom:nope'), DEFAULT_CHARACTER);
});

test('creates, edits and deletes custom avatars, keeping GIFs animated', () => {
  const { characters, userDataDir } = setup();
  assert.equal(characters.saveCustom({ idle: 'not-a-data-url' }), null);
  assert.equal(characters.saveCustom({ label: 'no image' }), null);

  const key = characters.saveCustom({ label: 'Dancing cat', idle: GIF, scale: 400 });
  assert.match(key, /^custom:[a-z0-9]+$/);
  const id = key.slice('custom:'.length);
  assert.ok(fs.existsSync(path.join(userDataDir, 'avatars', `${id}-idle.gif`)));

  const listed = characters.list().avatars.find((a) => a.key === key);
  assert.equal(listed.label, 'Dancing cat');
  assert.equal(listed.animated, true);
  assert.equal(listed.scale, 160, 'scale is clamped');

  // Replacing the GIF with a PNG removes the old file; adding a celebration pose.
  assert.equal(characters.saveCustom({ id, idle: PNG, celebrate: GIF, flip: true }), key);
  assert.equal(fs.existsSync(path.join(userDataDir, 'avatars', `${id}-idle.gif`)), false);
  const sprites = characters.sprites(key);
  assert.equal(sprites.kind, 'custom');
  assert.equal(sprites.flip, true);
  assert.match(sprites.idle, /^data:image\/png;base64,/);
  assert.match(sprites.celebrate, /^data:image\/gif;base64,/);

  assert.equal(characters.select(key), true);
  assert.equal(characters.deleteCustom(id), true);
  assert.equal(characters.defaultKey(), DEFAULT_CHARACTER, 'deleting the default falls back');
  assert.equal(characters.getCustom(id), null);
});

test('migrates the single custom character of older versions', () => {
  const { characters, store, userDataDir } = setup();
  fs.writeFileSync(
    path.join(userDataDir, 'custom-idle.png'),
    Buffer.from(PNG.split(',')[1], 'base64'),
  );
  fs.writeFileSync(
    path.join(userDataDir, 'custom-drinking.png'),
    Buffer.from(PNG.split(',')[1], 'base64'),
  );
  store.set({ character: 'custom' });
  characters.migrateLegacy();
  assert.equal(characters.defaultKey(), 'custom:legacy');
  assert.equal(characters.getCustom('legacy').label, 'My character');
});

test('bundled presets expose thumbnails and multi-pose sprites', () => {
  const { characters } = setup();
  const presets = characters.list().avatars.filter((a) => a.kind === 'preset');
  assert.ok(presets.length > 0);
  assert.ok(presets.every((p) => p.thumb?.startsWith('data:image/png')));
  const sprites = characters.sprites(DEFAULT_CHARACTER);
  assert.ok(sprites.idle && sprites.celebrate);
  assert.ok(Object.keys(sprites.poses).length > 0);
});

test('every bundled preset ships the required sprites and only known poses', () => {
  for (const preset of PRESETS) {
    assert.ok(fs.existsSync(preset.idle), `${preset.key} is missing idle.png`);
    assert.ok(fs.existsSync(preset.drinking), `${preset.key} is missing drink.png`);
    const sprites = fs.readdirSync(preset.posesDir).filter((f) => f.endsWith('.png'));
    for (const file of sprites) {
      assert.ok(POSE_NAMES.includes(path.basename(file, '.png')), `${preset.key}: unknown ${file}`);
    }
  }
});
