let m = require('mithril');
let rs = require('rswebui');

let downloads = require('files_downloads');
let uploads = require('files_uploads');


const Layout = {
  view: vnode => m('.tab-page', [
    m(downloads),
    m(uploads),
  ]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

