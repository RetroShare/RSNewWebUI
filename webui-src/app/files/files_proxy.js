const m = require('mithril');
const rs = require('rswebui');
const futil = require('files/files_util');

const fileProxyObj = futil.createProxy({}, () => {
  m.redraw();
});

rs.events[rs.RsEventsType.FILE_TRANSFER] = {
  handler: (event) => {
    console.log('search results : ', event);

    // if request item doesn't already exists in Object then create new item
    if (!Object.prototype.hasOwnProperty.call(fileProxyObj, event.mRequestId)) {
      fileProxyObj[event.mRequestId] = [];
    }

    fileProxyObj[event.mRequestId].push(...event.mResults);
  },
};

module.exports = {
  fileProxyObj,
};
