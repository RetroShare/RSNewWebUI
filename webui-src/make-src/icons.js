#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Builds assets/images/icons.svg — one <symbol> sprite from @phosphor-icons/core.
//
// The web UI used 118 distinct Font Awesome glyphs, across eight fa-user-*
// variants, eight fa-file-* variants and four spellings of "comment". Mapped
// onto Phosphor they collapse to the set below.
//
// Regular weight is the default. Duotone is reserved for the icons that carry
// connection state: both its layers inherit currentColor, the tint at 20%, so
// colouring one var(--reach-1) renders it duotone in that hue for free.
// Duotone on everything is noise.
//
// Run via `npm run icons`; `npm run build` runs it first.
// -----------------------------------------------------------------------------
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'node_modules', '@phosphor-icons', 'core', 'assets');
const OUT = path.join(__dirname, '..', 'assets', 'images', 'icons.svg');
const MODULE = path.join(__dirname, '..', 'app', 'icon_sprite.js');

// fa name (without the `fa-` prefix) -> phosphor name
const MAP = {
  'angle-double-left': 'caret-double-left',
  'angle-right': 'caret-right',
  'arrow-down': 'arrow-down',
  'arrow-left': 'arrow-left',
  'arrow-up': 'arrow-up',
  ban: 'prohibit',
  bars: 'list',
  bell: 'bell',
  bookmark: 'bookmark-simple',
  bug: 'bug',
  bullhorn: 'megaphone',
  'chart-pie': 'chart-pie-slice',
  check: 'check',
  'check-circle': 'check-circle',
  'chevron-down': 'caret-down',
  'chevron-left': 'caret-left',
  'chevron-right': 'caret-right',
  'chevron-up': 'caret-up',
  circle: 'circle',
  clock: 'clock',
  cogs: 'gear-six',
  comment: 'chat-circle',
  'comment-alt': 'chat',
  'comment-dots': 'chat-circle-dots',
  comments: 'chats-circle',
  compress: 'corners-in',
  copy: 'copy',
  cube: 'cube',
  download: 'download-simple',
  edit: 'pencil-simple',
  'ellipsis-v': 'dots-three-vertical',
  envelope: 'envelope',
  'envelope-open': 'envelope-open',
  'envelope-open-text': 'envelope-open',
  eraser: 'eraser',
  'exclamation-triangle': 'warning',
  'external-link-alt': 'arrow-square-out',
  expand: 'corners-out',
  eye: 'eye',
  file: 'file',
  'file-alt': 'file-text',
  'file-archive': 'file-zip',
  'file-audio': 'file-audio',
  'file-image': 'file-image',
  'file-medical': 'file-plus',
  'file-pdf': 'file-pdf',
  'file-video': 'file-video',
  fingerprint: 'fingerprint',
  fire: 'fire',
  folder: 'folder',
  'folder-open': 'folder-open',
  'folder-plus': 'folder-plus',
  forward: 'arrow-bend-up-right',
  globe: 'globe',
  'globe-europe': 'globe-hemisphere-west',
  'hand-paper': 'hand',
  history: 'clock-counter-clockwise',
  home: 'house',
  'id-card': 'identification-card',
  image: 'image',
  inbox: 'tray',
  'info-circle': 'info',
  'layer-group': 'stack',
  link: 'link',
  'mail-bulk': 'envelope-simple',
  minus: 'minus',
  'network-wired': 'tree-structure',
  'paper-plane': 'paper-plane-tilt',
  paperclip: 'paperclip',
  pen: 'pencil-simple',
  'pencil-alt': 'pencil-simple',
  pause: 'pause',
  play: 'play',
  plus: 'plus',
  'arrow-circle-up': 'arrow-circle-up',
  'arrow-circle-down': 'arrow-circle-down',
  'project-diagram': 'graph',
  'quote-right': 'quotes',
  reply: 'arrow-bend-up-left',
  'reply-all': 'arrow-bend-double-up-left',
  'satellite-dish': 'cell-tower',
  search: 'magnifying-glass',
  server: 'hard-drives',
  'share-alt': 'share-network',
  'shield-alt': 'shield',
  'sign-in-alt': 'sign-in',
  'sign-out-alt': 'sign-out',
  smile: 'smiley',
  sort: 'arrows-down-up',
  'sort-amount-down': 'sort-descending',
  'sort-down': 'caret-down',
  'sort-up': 'caret-up',
  spinner: 'spinner',
  square: 'square',
  star: 'star',
  'sticky-note': 'note',
  stopwatch: 'timer',
  stream: 'list-dashes',
  'sync-alt': 'arrows-clockwise',
  tag: 'tag',
  'tachometer-alt': 'gauge',
  'th-large': 'squares-four',
  'thumbs-down': 'thumbs-down',
  'thumbs-up': 'thumbs-up',
  times: 'x',
  trash: 'trash',
  'trash-alt': 'trash',
  tv: 'television-simple',
  unlink: 'link-break',
  upload: 'upload-simple',
  user: 'user',
  'user-circle': 'user-circle',
  'user-edit': 'user-gear',
  'user-friends': 'users',
  'user-lock': 'lock-key',
  'user-minus': 'user-minus',
  'user-plus': 'user-plus',
  'user-times': 'user-minus',
  users: 'users',
  'volume-mute': 'speaker-slash',
  'volume-up': 'speaker-high',
};

// These carry connection state, so they ship in duotone as well: `i-<name>-duo`.
const STATEFUL = ['user', 'users', 'user-circle', 'share-alt', 'network-wired',
  'circle', 'satellite-dish', 'server', 'globe', 'link'];

// These are toggles, and a filled glyph reads as "on" at a glance where a
// colour change alone does not: `i-<name>-fill`.
const FILLED = ['star', 'fire'];

function body(weight, phosphor) {
  const suffix = weight === 'regular' ? '' : '-' + weight;
  const file = path.join(ASSETS, weight, phosphor + suffix + '.svg');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*fill="currentColor"/g, '')
    .trim();
}

const symbols = [];
const missing = [];
const seen = new Set();

for (const [fa, phosphor] of Object.entries(MAP)) {
  const d = body('regular', phosphor);
  if (!d) { missing.push(`${fa} -> ${phosphor}`); continue; }
  if (seen.has(fa)) continue;
  seen.add(fa);
  symbols.push(`<symbol id="i-${fa}" viewBox="0 0 256 256">${d}</symbol>`);
}

for (const fa of STATEFUL) {
  const phosphor = MAP[fa];
  const d = body('duotone', phosphor);
  if (!d) { missing.push(`${fa} -> ${phosphor} (duotone)`); continue; }
  // Phosphor's duotone tint inherits currentColor at 20% opacity, so an icon
  // coloured var(--reach-1) is already duotone in that hue. Nothing to rewrite.
  symbols.push(`<symbol id="i-${fa}-duo" viewBox="0 0 256 256">${d}</symbol>`);
}

for (const fa of FILLED) {
  const phosphor = MAP[fa] || fa;
  const d = body('fill', phosphor);
  if (!d) { missing.push(`${fa} -> ${phosphor} (fill)`); continue; }
  symbols.push(`<symbol id="i-${fa}-fill" viewBox="0 0 256 256">${d}</symbol>`);
}

if (missing.length) {
  console.error('Icons not found in @phosphor-icons/core:');
  missing.forEach((m) => console.error('  ' + m));
  process.exit(1);
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols.join('')}</svg>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, sprite + '\n');

// The sprite also ships inside app.js. An external <use href="file.svg#id">
// needs a second request, depends on the service returning image/svg+xml, and
// is not supported at all by Safari — so icon.js injects this string once
// instead. The .svg file is kept for anything that wants to reference it.
fs.writeFileSync(MODULE,
  `// GENERATED by make-src/icons.js — do not edit.\n`
  + `// One <symbol> sprite from @phosphor-icons/core, injected once by icon.js.\n`
  + `module.exports = ${JSON.stringify(sprite)};\n`);

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`icons: ${symbols.length} symbols (${seen.size} regular, ${STATEFUL.length} duotone, ${FILLED.length} fill), ${kb} KB, inlined into app/icon_sprite.js`);
