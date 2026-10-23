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
  appearance: require('config/config_appearance'),
};

const labels = {
  network: 'Network',
  node: 'Node',
  services: 'Services',
  files: 'Files',
  people: 'Identities',
  chat: 'Chat',
  mail: 'Mail',
  appearance: 'Appearance',
};

const icons = {
  network: 'network-wired',
  node: 'server',
  services: 'layer-group',
  files: 'folder',
  people: 'users',
  chat: 'comments',
  mail: 'envelope',
  appearance: 'adjust',
};

const descriptions = {
  network: 'Manage connectivity, discovery and proxy access.',
  node: 'Connection details and the identity of this RetroShare node.',
  services: 'Choose which services are available to friends by default.',
  files: 'Shared folders, download locations and transfer limits.',
  people: 'Contact preferences, reputation and identity retention.',
  chat: 'Default identity, chat permissions and stored history.',
  mail: 'Message permissions and the tags used to organize mail.',
  appearance: 'Choose how RetroShare looks in this browser.',
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
    m('.node-panel', m('.settings-page', [
      m(widget.PageHead, {
        title: `${labels[vnode.attrs.tab] || 'Network'} settings`,
        lead: descriptions[vnode.attrs.tab],
      }),
      m('.settings-body', vnode.children),
    ])),
  ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, { tab }, m(sections[tab] || sections.network));
  },
};
