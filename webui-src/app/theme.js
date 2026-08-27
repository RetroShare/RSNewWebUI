const m = require('mithril');

const STORAGE_KEY = 'retroshare-webui-theme';
const MODES = ['system', 'light', 'dark'];
let mode = readMode();

function readMode() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored) ? stored : 'system';
  } catch (_) {
    return 'system';
  }
}

function systemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function apply() {
  const effectiveTheme = mode === 'system' ? systemTheme() : mode;
  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.dataset.themePreference = mode;
  document.documentElement.style.colorScheme = effectiveTheme;
}

function setMode(nextMode) {
  if (!MODES.includes(nextMode)) return;
  mode = nextMode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch (_) {
    // The theme still works for this session when storage is unavailable.
  }
  apply();
  m.redraw();
}

function nextMode() {
  setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
}

function icon() {
  if (mode === 'dark') return 'fa-moon';
  if (mode === 'light') return 'fa-sun';
  return 'fa-adjust';
}

const ThemeToggle = {
  view: (vnode) => m('button.theme-toggle[type=button]', {
    class: vnode.attrs.compact ? 'theme-toggle--compact' : '',
    title: `Theme: ${mode}. Click to change.`,
    'aria-label': `Theme: ${mode}. Click to use ${MODES[(MODES.indexOf(mode) + 1) % MODES.length]} mode.`,
    onclick: nextMode,
  }, [
    m(`i.fas.${icon()}[aria-hidden=true]`),
    vnode.attrs.compact ? null : m('span', `Theme: ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`),
  ]),
};

apply();
if (window.matchMedia) {
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const updateSystemTheme = () => {
    if (mode === 'system') {
      apply();
      m.redraw();
    }
  };
  if (colorScheme.addEventListener) colorScheme.addEventListener('change', updateSystemTheme);
  else if (colorScheme.addListener) colorScheme.addListener(updateSystemTheme);
}

module.exports = { ThemeToggle, getMode: () => mode, setMode };
