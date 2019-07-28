const m = require('mithril');
const rs = require('rswebui');
const util = require('mail_util');


const Layout = () => {
  return {
    view: (vnode) => [
      m('.widget', m('table', [
        m('thead', m('tr', [
          m('th'),
        ])),
        m('tbody', [
          m('tr')
        ]),
      ])),
    ]
  };
};

module.exports = Layout;

