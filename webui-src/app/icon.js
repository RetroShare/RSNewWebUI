const m = require('mithril');

// -----------------------------------------------------------------------------
// Icons.
//
// One <symbol> sprite built from @phosphor-icons/core by make-src/icons.js and
// served from the node — 129 symbols in a single cacheable request, replacing
// Font Awesome's 1400-glyph webfont of which the UI used 118.
//
// The sprite is injected into the document once, from a string that ships in
// app.js. It is not an external <use href="file.svg#id">: that needs a second
// request, depends on the service returning image/svg+xml, and Safari does not
// support it at all.
//
// Both layers of a duotone symbol inherit currentColor (the tint at 20%), so
// setting `color` alone renders the whole icon; pass `duo: true` on the icons
// that carry connection state and colour them with a --reach-* token.
//
//   icon('home')
//   icon('users', { duo: true, class: 'peer-icon' })
//   icon('spinner', { spin: true })
//   icon('trash', { size: 22, title: 'Delete' })
// -----------------------------------------------------------------------------

const sprite = require('icon_sprite');

let injected = false;

function ensureSprite() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const host = document.createElement('div');
  host.id = 'rs-icon-sprite';
  host.setAttribute('aria-hidden', 'true');
  host.style.display = 'none';
  host.innerHTML = sprite;
  document.body.appendChild(host);
}

function icon(name, attrs) {
  ensureSprite();
  const { duo, spin, size, class: cls, title, ...rest } = attrs || {};

  const classes = ['icon'];
  if (spin) classes.push('icon--spin');
  if (cls) classes.push(cls);

  return m(
    'svg',
    {
      class: classes.join(' '),
      viewBox: '0 0 256 256',
      // Decorative by default: the adjacent label carries the meaning. A caller
      // that passes `title` is saying the icon is the only label there is.
      'aria-hidden': title ? undefined : 'true',
      role: title ? 'img' : undefined,
      focusable: 'false',
      ...(size ? { width: size, height: size } : {}),
      ...rest,
    },
    [
      title ? m('title', title) : null,
      m('use', { href: `#i-${name}${duo ? '-duo' : ''}` }),
    ]
  );
}

module.exports = icon;
