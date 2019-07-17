let m = require('mithril');
let rs = require('rswebui');

let Files = {
  oninit: function() {},
  view: function() {
    return [
      m('.widget', [
        m('h3', 'Shared Directories'),
        m('hr'),
        m('input'),
      ]),
      m('.widget', [
        m('h3', 'Transfer options'),
        m('hr'),
        m('.grid-2col', [
          m('p', 'Default chunk strategy:'),
          m('input'),
          m('p', 'Safety disk space limit:'),
          m('input'),
        ]),
      ]),
      m('.widget.widget-halfwidth', [
        m('h3', 'Incoming Directory'),
        m('hr'),
        m('input'),
      ]),
      m('.widget.widget-halfwidth', [
        m('h3', 'Partials Directory'),
        m('hr'),
        m('input'),
      ]),
    ];
  },
};

module.exports = Files;

