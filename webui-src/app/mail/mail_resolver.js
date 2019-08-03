let m = require('mithril');
let rs = require('rswebui');


let sections = {
  inbox: require('mail_inbox'),
  outbox: require('mail_outbox'),
};

const sidebar = () => {
  let active = 0;
  const tabs = Object.keys(sections);
  return {
    view: () => m('.sidebar',
      tabs.map((panelName, index) => m('a', {
          href: '/mail/' + panelName,
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

const Layout = {
  view: vnode => m('.tab-page', [
    m(sidebar),
    m('.node-panel', vnode.children),
  ])
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};

