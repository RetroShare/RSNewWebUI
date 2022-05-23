const m = require('mithril');
const widget = require('widgets');

const sections = {
  MyForums: require('channels/my_forums'),
  SubscribedFroums: require('channels/subscribed_forums'),
  PopularForums: require('channels/popular_forums'),
  OtherForums: require('channels/other_forums')
}

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/channels/',
      }),
      m('.node-panel .', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
