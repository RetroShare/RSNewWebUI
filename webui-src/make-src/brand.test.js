const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const logo = require('../app/brand_logo');

test('the embedded logo matches the source asset and keeps its intrinsic ratio', () => {
  const prefix = 'data:image/svg+xml;base64,';
  assert.ok(logo.startsWith(prefix));
  const svg = Buffer.from(logo.slice(prefix.length), 'base64').toString('utf8');
  assert.equal(svg, readFileSync(path.join(__dirname, '../assets/images/retroshare.svg'), 'utf8'));
  assert.match(svg, /viewBox="0 0 200 200"/);
});
