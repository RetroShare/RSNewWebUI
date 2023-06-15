const m = require('mithril');
const widget = require('widgets');

const sections = {
  OwnIdentity: require('people/people_ownids'),
  MyContacts: require('people/people_own_contacts'),
  All: require('people/people'),
};

const Layout = {
  view: (vnode) => [
    m(widget.Sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/people/',
    }),
    m('.node-panel .', vnode.children),
  ],
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
