const m = require('mithril');
const futil = require('files/files_util');

const fileProxyObj = futil.createProxy({}, () => {
  m.redraw();
});

module.exports = {
  fileProxyObj,
};
