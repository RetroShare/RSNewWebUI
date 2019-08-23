let m = require('mithril');
let rs = require('rswebui');
let widget = require('widgets');


let sections = {
  network: require('config_network'),
  node: require('config_node'),
  services: require('config_services'),
  files: require('config_files'),
  people: require('config_people'),
};

const Layout = {
  view: vnode => m('.tab-page', [
    m(widget.Sidebar, {
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

