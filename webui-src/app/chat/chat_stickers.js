'use strict';

const m = require('mithril');

const state = {
  groups: [],
  loading: false,
  loaded: false,
  error: '',
  activeGroup: 0,
};

function scrollToPack(index) {
  const section = document.getElementById(`sticker-pack-${index}`);
  if (section) section.scrollIntoView({ block: 'start', behavior: 'smooth' });
  state.activeGroup = index;
}

function isAndroid() {
  return /Android/i.test((window.navigator && window.navigator.userAgent) || '');
}

function imageTag(dataUrl, name) {
  const safeName = String(name || 'sticker').replace(/["<>]/g, '');
  return `<img src="${dataUrl}" alt="${safeName}" title="${safeName}">`;
}

async function loadInstalledStickers() {
  if (state.loading || state.loaded) return;
  state.loading = true;
  state.error = '';
  try {
    const response = await window.fetch('/stickers/index.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.groups = Array.isArray(payload.groups) ? payload.groups : [];
    state.loaded = true;
  } catch (error) {
    state.error = 'Installed stickers are not available from this RetroShare core.';
  } finally {
    state.loading = false;
    m.redraw();
  }
}

function fileToDataUrl(file, done) {
  const reader = new window.FileReader();
  reader.onload = () => done(reader.result);
  reader.onerror = () => done('');
  reader.readAsDataURL(file);
}

const StickerPicker = () => ({
  oninit: loadInstalledStickers,
  view: ({ attrs }) => {
    const groups = state.groups;
    return m('.sticker-picker', [
      state.loading && m('.sticker-picker__status', 'Loading stickers…'),
      state.error && m('.sticker-picker__status', state.error),
      groups.length > 0 && m('.sticker-picker__packs', groups.map((item, index) =>
        m('section.sticker-picker__section', { id: `sticker-pack-${index}` }, [
          m('.sticker-picker__heading', `${item.name} (${(item.stickers || []).length})`),
          m('.sticker-picker__grid', (item.stickers || []).map((sticker) =>
            m('button.sticker-picker__item', {
              type: 'button',
              title: sticker.name,
              onclick: (event) => {
                event.stopPropagation();
                attrs.onSelect(imageTag(sticker.src, sticker.name));
              },
            }, m('img', { src: sticker.src, alt: sticker.name, loading: 'lazy' }))
          )),
        ])
      )),
      groups.length > 1 && m('.sticker-picker__pack-bar', groups.map((item, index) => {
        const first = item.stickers && item.stickers[0];
        return m('button.sticker-picker__pack-button' + (index === state.activeGroup ? '.active' : ''), {
          type: 'button',
          title: item.name,
          onclick: (event) => {
            event.stopPropagation();
            scrollToPack(index);
          },
        }, first
          ? m('img', { src: first.src, alt: item.name })
          : m('i.fas.fa-sticky-note'));
      })),
      state.loaded && !groups.length && m('.sticker-picker__status', 'No stickers installed.'),
    ]);
  },
});

const StickerControl = () => ({
  view: ({ attrs }) => {
    const android = isAndroid();
    return m('.sticker-picker-wrapper', [
    android
      ? m('label.chat-hub-action-btn', { title: 'Choose sticker' }, [
        m('i.fas.fa-sticky-note'),
        m('input[type=file][accept=image/png,image/jpeg,image/gif,image/webp]', {
          style: 'display: none;',
          disabled: attrs.disabled,
          onchange: (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) fileToDataUrl(file, (src) => {
              if (src) attrs.onSelect(imageTag(src, file.name));
            });
            event.target.value = '';
          },
        }),
      ])
      : m('button.chat-hub-action-btn', {
        type: 'button',
        disabled: attrs.disabled,
        title: 'Stickers',
        onclick: (event) => {
          event.stopPropagation();
          attrs.state.showStickerPicker = !attrs.state.showStickerPicker;
          if (attrs.onToggle) attrs.onToggle();
          if (attrs.state.showStickerPicker) loadInstalledStickers();
        },
      }, m('i.fas.fa-sticky-note')),
    !android && attrs.state.showStickerPicker && m(StickerPicker, {
      onSelect: (tag) => {
        attrs.state.showStickerPicker = false;
        attrs.onSelect(tag);
      },
    }),
    ]);
  },
});

module.exports = { StickerControl, loadInstalledStickers, isAndroid };
