let m = require('mithril');
let rs = require('rswebui');

let component = {
  view: function() {
    return m('.tab', [
      m('.sidebar', [
        m('a.sidebar-link', 'General'),
        m('a.sidebar-link', 'Node'),
      ]),
      m('.frame')
  ]);
  },
};

module.exports = {
  component,
};
