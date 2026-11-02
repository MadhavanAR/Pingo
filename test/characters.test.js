'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Characters } = require('../src/main/characters');
const { Store } = require('../src/main/store');
const { DEFAULT_CHARACTER, CUSTOM_CHARACTER, PRESETS, POSE_NAMES } = require('../src/main/config');

const silent = { error() {}, warn() {} };
const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');

function setup() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pingo-chars-'));
  const store = new Store(path.join(userDataDir, 'config.json'), { logger: silent });
  return { characters: new Characters({ userDataDir, store, logger: silent }), store };
}

test('defaults to the bundled character and ignores unknown keys', () => {
  const { characters, store } = setup();
  assert.equal(characters.activeKey(), DEFAULT_CHARACTER);
  store.set({ character: 'retired-character' });
  assert.equal(characters.activeKey(), DEFAULT_CHARACTER);
  assert.equal(characters.select('../../etc'), false);
  assert.equal(characters.select(CUSTOM_CHARACTER), false, 'custom needs sprites first');
});

test('saves, activates and resets a custom character', () => {
  const { characters } = setup();
  assert.equal(characters.saveCustom(PNG, 'not-a-data-url'), false);
  assert.equal(characters.hasCustom(), false);

  assert.equal(characters.saveCustom(PNG, PNG), true);
  assert.equal(characters.hasCustom(), true);
  assert.equal(characters.activeKey(), CUSTOM_CHARACTER);
  assert.match(characters.activeSprites().idle, /^data:image\/png;base64,/);

  assert.equal(characters.resetCustom(), true);
  assert.equal(characters.hasCustom(), false);
  assert.equal(characters.activeKey(), DEFAULT_CHARACTER);
});

test('bundled preset exposes thumbnails and multi-pose sprites', () => {
  const { characters } = setup();
  const info = characters.presetsInfo();
  assert.ok(info.presets.length > 0);
  assert.ok(info.presets.every((p) => p.thumb?.startsWith('data:image/png')));
  const sprites = characters.activeSprites();
  assert.ok(sprites.idle && sprites.drinking);
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
