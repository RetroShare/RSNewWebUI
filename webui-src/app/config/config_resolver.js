const m = require('mithril');
const widget = require('widgets');

const sections = {
  network: require('config/config_network'),
  node: require('config/config_node'),
  services: require('config/config_services'),
  files: require('config/config_files'),
  people: require('config/config_people'),
  chat: require('config/config_chat'),
  mail: require('config/config_mail'),
};

const labels = {
  network: 'Network',
  node: 'Node',
  services: 'Services',
  files: 'Files',
  people: 'Identities',
  chat: 'Chat',
  mail: 'Mail',
};

const icons = {
  network: 'network-wired',
  node: 'server',
  services: 'layer-group',
  files: 'folder',
  people: 'users',
  chat: 'comments',
  mail: 'envelope',
};

const Layout = {
  view: (vnode) => m('.config', [
    m(widget.Sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/config/',
      mobileDrawer: true,
      title: 'Settings',
      labels,
      icons,
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
