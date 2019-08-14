let m = require('mithril');
let rs = require('rswebui');


const sidebar = () => {
  let active = 0;
  return {
    view: (v) => m('.sidebar',
      v.attrs.tabs.map((panelName, index) => m('a', {
          href: v.attrs.baseRoute + panelName,
          oncreate: m.route.link,
          class: index === active ?
            'selected-sidebar-link' : '',
          onclick: function() {
            active = index;
          },
        },
        panelName)),
    ),
  };
};

let sections = {
  network: require('config_network'),
  node: require('config_node'),
  services: require('config_services'),
  files: require('config_files'),
  people: require('config_people'),
};

const Layout = {
  view: vnode => m('.tab-page', [
    m(sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/config/',
    }),
    m('.node-panel', vnode.children),
  ])
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};

