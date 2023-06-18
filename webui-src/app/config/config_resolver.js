const m = require('mithril');
const rs = require('rswebui');

const widget = require('widgets');

const sections = {
  network: require('config/config_network'),
  node: require('config/config_node'),
  services: require('config/config_services'),
  files: require('config/config_files'),
  people: require('config/config_people'),
  mail: require('config/config_mail'),
};

const Layout = {
  view: (vnode) => [
    m(widget.Sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/config/',
    }),
    m('.node-panel', vnode.children),
  ],
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
