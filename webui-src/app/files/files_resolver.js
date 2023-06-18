const m = require('mithril');

const widget = require('widgets');

const downloads = require('files/files_downloads');
const uploads = require('files/files_uploads');
const util = require('files/files_util');
const search = require('files/files_search');
const myfile = require('files/my_files');
const friendfile = require('files/friends_files');

const MyFiles = () => {
  return {
    view: () => [
      m('.widget__heading', [
        m('h3', 'File Transfers'),
        m(util.SearchBar, {
          list: Object.assign({}, downloads.list, uploads.list),
        }),
      ]),
      m('.widget__body', [m(downloads.Component), m(uploads.Component)]),
    ],
  };
};

const sections = {
  files: MyFiles,
  search,
  MyFiles: myfile,
  FriendsFiles: friendfile,
};

const Layout = {
  view: (vnode) => [
    m(widget.Sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/files/',
    }),
    m('.node-panel', m('.widget', vnode.children)),
  ],
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
