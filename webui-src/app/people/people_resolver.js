let m = require('mithril');
let rs = require('rswebui');
let widget = require('widgets');

let sections = {
  OwnIdentity: require('people/people_ownids'),
  MyContacts: require('people/own_contacts'),
  All: require('people/people'),
};

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/people/',
      }),
      m('.node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
