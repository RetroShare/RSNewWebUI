let m = require('mithril');
let rs = require('rswebui');


const sidebar = () => {
  let active = 0;
  const tabs = Object.keys(sections);
  return {
    view: () => m('.sidebar',
      tabs.map((panelName, index) => m('a', {
          href: '/config/' + panelName,
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
    m(sidebar),
    m('.node-panel', vnode.children),
  ])
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.section;
    return m(Layout, m(sections[tab]));
  },
};

