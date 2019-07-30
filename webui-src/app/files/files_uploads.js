let m = require('mithril');
let rs = require('rswebui');
let util = require('files_util')


let Uploads = {
  statusMap: new Map(),
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest(
      '/rsFiles/FileUploads', {},
      (d) => Uploads.hashes = d.hashs,
    );
  },

  loadStatus() {
    Uploads.loadHashes();
    if(Uploads.hashes.length !== Uploads.statusMap.size) {
      Uploads.statusMap.clear();
    }
    Uploads.hashes.map(
      (hash) => rs.rsJsonApiRequest(
        '/rsFiles/FileDetails', {
          hash,
          hintflags: 16, // RS_FILE_HINTS_DOWNLOAD TODO???
        },
        (fileStat) => Uploads.statusMap.set(hash, fileStat.info),
      ));
  },
};

let backgroundCallback = function() {
  this.loadStatus();
};
backgroundCallback = backgroundCallback.bind(Uploads);

const Component = () => {
  return {
    oninit: () => rs.setBackgroundTask(
      backgroundCallback,
      1000,
      () => {
        return (m.route.get() === '/files')
      }
    ),
    view: () => m('.widget', [
      m('h3', 'Uploads'),
      m('hr'),
      Array.from(Uploads.statusMap,
        (fileStatus) => m(util.File, {
          info: fileStatus[1],
        })),
    ])
  };
}
module.exports = Component;

