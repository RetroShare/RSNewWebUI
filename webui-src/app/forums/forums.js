const m = require('mithril');
const widget = require('widgets');

const sections = {
  MyForums: require('forums/my_forums'),
  SubscribedForums: require('forums/subscribed_forums'),
  PopularForums: require('forums/popular_forums'),
  OtherForums: require('forums/other_forums')
}

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/forums/',
      }),
      m('.forums-node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
