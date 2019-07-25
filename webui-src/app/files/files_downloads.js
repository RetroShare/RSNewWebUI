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
    Downloads.statusMap.clear();
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
      Array.from(Downloads.statusMap, function(fileStatus) {
        let info = fileStatus[1];
        let progress = info.transfered / info.size * 100;
        return m('.file-view', [
          m('p', info.fname),
          util.actionButton(info, 'cancel'),
          util.actionButton(info, info.downloadStatus ===
            util.FT_STATE_PAUSED ? 'resume' : 'pause'),
          util.progressBar(progress),
          m('span', m('i.fas.fa-file'), util.makeFriendlyUnit(
            info.size)),
          m('span', m('i.fas.fa-arrow-circle-down'),
            util.makeFriendlyUnit(info.tfRate * 1024) + '/s'),
        ]);
      }),
    ]);
  },
};

module.exports = Component;

