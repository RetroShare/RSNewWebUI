let m = require('mithril');
let rs = require('rswebui');

let downloads = require('files_downloads');
let uploads = require('files_uploads');
let util = require('files_util');


const Layout = {
  view: vnode => m('.tab-page', [
    m(util.SearchBar, {
      list: Object.assign({}, downloads.list, uploads.list),
    }),
    m(downloads.Component),
    m(uploads.Component),
  ]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

