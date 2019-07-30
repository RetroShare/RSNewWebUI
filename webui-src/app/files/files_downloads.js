let m = require('mithril');
let rs = require('rswebui');
let util = require('files_util')


let Downloads = {
  statusMap: new Map(),
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest(
      '/rsFiles/FileDownloads', {},
      (d) => Downloads.hashes = d.hashs,
    );
  },

  loadStatus() {
    Downloads.loadHashes();
    // TODO more comprehensive check
    if(Downloads.hashes.length !== Downloads.statusMap.size) {
      Downloads.statusMap.clear();
    }
    for(let hash of Downloads.hashes) {
      rs.rsJsonApiRequest(
        '/rsFiles/FileDetails', {
          hash,
          hintflags: 16, // RS_FILE_HINTS_DOWNLOAD
        },
        (fileStat) => Downloads.statusMap.set(hash, fileStat.info),
      );
    }
  },
};


let backgroundCallback = function() {
  this.loadStatus();
};
// Bind to Downloads so it doesn't lose scope
backgroundCallback = backgroundCallback.bind(Downloads);

let Component = {
  oninit: () => rs.setBackgroundTask(
    backgroundCallback,
    1000,
    () => {
      return (m.route.get() === '/files')
    }
  ),
  view: function() {
    return m('.widget', [
      m('h3', 'Downloads'),
      m('hr'),
      Array.from(Downloads.statusMap,
        (fileStatus) => m(util.File, {
          info: fileStatus[1],
        })),
    ]);
  },
};

module.exports = Component;

