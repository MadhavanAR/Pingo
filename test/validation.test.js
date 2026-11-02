'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dataUrlToBuffer } = require('../src/main/validation');

test('dataUrlToBuffer accepts only base64 image data URLs within the size cap', () => {
  const png = 'data:image/png;base64,' + Buffer.from('hello').toString('base64');
  assert.deepEqual(dataUrlToBuffer(png), Buffer.from('hello'));
  assert.equal(dataUrlToBuffer(png, 4), null);
  assert.equal(dataUrlToBuffer('data:text/html;base64,PGI+'), null);
  assert.equal(dataUrlToBuffer('data:image/png;base64,'), null);
  assert.equal(dataUrlToBuffer(42), null);
});
