const m = require('mithril');
const { Menu } = require('widgets');
const appearance = require('appearance');

const options = [
  { id: 'system', label: 'System', icon: 'desktop' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

module.exports = {
  view: ({ attrs }) => {
    const preference = appearance.getPreference();
    const selected = options.find((option) => option.id === preference);
    return m(Menu, {
      class: 'appearance-control',
      mark: selected.icon,
      title: `Appearance: ${selected.label}`,
      buttonClass: 'is-glyph',
      up: attrs.up !== false,
      items: options.map((option) => ({
        label: option.label,
        icon: option.icon,
        selected: preference === option.id,
        onclick: () => appearance.setPreference(option.id),
      })),
    });
  },
};
