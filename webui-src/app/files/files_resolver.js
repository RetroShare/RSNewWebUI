let m = require('mithril');
let rs = require('rswebui');

let downloads = require('files_downloads');
let uploads = require('files_uploads');
let util = require('files_util');


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

const MyFiles = () => {
  return {
    view: (vnode) => [
      m(util.SearchBar, {
        list: Object.assign({}, downloads.list, uploads.list),
      }),
      m(downloads.Component),
      m(uploads.Component),
    ],
  };
};

let sections = {
  files: MyFiles,
};

const Layout = {
  view: (vnode) => m('.tab-page', [
    m(sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/files/',
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

