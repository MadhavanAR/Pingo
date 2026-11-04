'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/main/store');

const silent = { error() {}, warn() {} };
const tmpFile = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pingo-store-')), 'sub', 'config.json');

test('returns fallbacks when the file does not exist', () => {
  const store = new Store(tmpFile(), { logger: silent });
  assert.equal(store.get('name', 'none'), 'none');
});

test('persists merged settings and reads them back', () => {
  const file = tmpFile();
  new Store(file, { logger: silent }).set({ name: 'Alex' });
  new Store(file, { logger: silent }).set({ intervalMin: 30 });
  const store = new Store(file, { logger: silent });
  assert.equal(store.get('name'), 'Alex');
  assert.equal(store.get('intervalMin'), 30);
  assert.deepEqual(
    fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp')),
    [],
    'no temp files left behind',
  );
});

test('treats corrupt or non-object JSON as empty settings', () => {
  for (const contents of ['{not json', '[1,2]', 'null']) {
    const file = tmpFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
    assert.equal(new Store(file, { logger: silent }).get('name', 'fallback'), 'fallback');
  }
});

test('a failed reload keeps the settings already in memory', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pingo-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  const store = new Store(file, { logger: { warn() {}, error() {} } });
  store.set({ name: 'Sam', reminders: [1] });
  fs.writeFileSync(file, '{ half-written');
  store.reload();
  store.set({ stats: {} });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    name: 'Sam',
    reminders: [1],
    stats: {},
  });
});
