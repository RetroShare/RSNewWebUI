const m = require('mithril');
const theme = require('theme');

const choices = [
  { value: 'system', icon: 'fa-adjust', title: 'System', description: 'Follow your device appearance setting.' },
  { value: 'light', icon: 'fa-sun', title: 'Light', description: 'Always use the light appearance.' },
  { value: 'dark', icon: 'fa-moon', title: 'Dark', description: 'Always use the dark appearance.' },
];

const Appearance = {
  view: () => m('.widget.config-appearance', [
    m('.widget__heading', m('h3', 'Appearance')),
    m('.widget__body', [
      m('p.config-appearance__intro', 'Choose how RetroShare WebUI looks on this device.'),
      m('fieldset.theme-choice', [
        m('legend', 'Theme'),
        choices.map((choice) => {
          const selected = theme.getMode() === choice.value;
          return m('label.theme-choice__option', { class: selected ? 'is-selected' : '' }, [
            m('input[type=radio][name=webui-theme]', {
              value: choice.value,
              checked: selected,
              onchange: () => theme.setMode(choice.value),
            }),
            m(`i.fas.${choice.icon}[aria-hidden=true]`),
            m('.theme-choice__copy', [
              m('strong', choice.title),
              m('span', choice.description),
            ]),
            selected ? m('i.fas.fa-check.theme-choice__check[aria-hidden=true]') : null,
          ]);
        }),
      ]),
      m('p.config-appearance__note', 'This preference is stored only in this browser.'),
    ]),
  ]),
};

module.exports = Appearance;
