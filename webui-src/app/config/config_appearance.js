const m = require('mithril');
const appearance = require('appearance');

module.exports = {
  view: () => m('.panel', [
    m('.panel__head', m('h3', 'Appearance')),
    m('.panel__body', [
      m('.config-grid', [
        m('label[for=appearance]', 'Color theme'),
        m('select#appearance', {
          value: appearance.getPreference(),
          'aria-describedby': 'appearance-help',
          onchange: (event) => appearance.setPreference(event.target.value),
        }, [
          m('option[value=system]', 'Use device setting'),
          m('option[value=light]', 'Light'),
          m('option[value=dark]', 'Dark'),
        ]),
      ]),
      m('p#appearance-help', 'Saved in this browser. Device setting follows your system automatically.'),
    ]),
  ]),
};
