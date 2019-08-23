let m = require('mithril');
let rs = require('rswebui');
let widget = require('widgets');

let downloads = require('files_downloads');
let uploads = require('files_uploads');
let util = require('files_util');
let search = require('files_search');


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
  search: search,
};

const Layout = {
  view: (vnode) => m('.tab-page', [
    m(widget.Sidebar, {
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

