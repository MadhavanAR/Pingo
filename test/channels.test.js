'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHANNELS } = require('../src/shared/channels');

const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload', 'index.js'), 'utf8');
const ipc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'ipc.js'), 'utf8');

test('preload only uses channels declared in src/shared/channels.js', () => {
  const declared = new Set(Object.values(CHANNELS));
  const used = [...preload.matchAll(/\(\s*'([a-z]+:[A-Za-z]+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const channel of used) assert.ok(declared.has(channel), `undeclared channel ${channel}`);
});

test('every renderer->main channel is used by preload and handled in ipc.js', () => {
  const outbound = Object.entries(CHANNELS).filter(
    ([key]) => !['REMINDER_SHOW', 'SPRITES_CHANGED'].includes(key),
  );
  for (const [key, channel] of outbound) {
    assert.ok(preload.includes(`'${channel}'`), `preload never uses ${channel}`);
    assert.ok(ipc.includes(`CHANNELS.${key}`), `ipc.js never handles ${key}`);
  }
});
