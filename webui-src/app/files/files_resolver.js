const m = require('mithril');

const widget = require('widgets');

const downloads = require('files/files_downloads');
const uploads = require('files/files_uploads');
const util = require('files/files_util');
const search = require('files/files_search');
const friendfile = require('files/friend_files');

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

const sections = {
  files: MyFiles,
  search,
  friendsFiles: friendfile,
};

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/files/',
      }),
      m('.file-node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
