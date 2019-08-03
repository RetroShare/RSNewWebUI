let m = require('mithril');
let rs = require('rswebui');


const Layout = {
  view: vnode => m('.tab-page', [
    m('.widget', [
      m('h3', 'Chat rooms'),
      m('hr'),
    ]),
  ]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

