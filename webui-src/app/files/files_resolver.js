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
      m(widget.PageHead, {
        title: 'File Transfers',
        lead: 'Downloads and uploads moving through your node.',
        actions: m(util.SearchBar, {
          list: Object.assign({}, downloads.list, uploads.list),
        }),
      }),
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

const navLabels = {
  files: 'Transfers',
  search: 'Search',
  MyFiles: 'My Files',
  FriendsFiles: 'Friends\' Files',
};

const navIcons = {
  files: 'download',
  search: 'search',
  MyFiles: 'folder',
  FriendsFiles: 'user-friends',
};

const Layout = {
  view: (vnode) => [
    m(widget.Sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/files/',
      mobileDrawer: true,
      title: 'Files',
      labels: navLabels,
      icons: navIcons,
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
