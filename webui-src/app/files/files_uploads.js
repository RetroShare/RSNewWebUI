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
    Uploads.statusMap.clear();
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
      Array.from(Uploads.statusMap, function(fileStatus) {
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
          m('span', m('i.fas.fa-arrow-circle-up'),
            util.makeFriendlyUnit(info.tfRate * 1024) + '/s'),
        ]);
      }),
    ])
  };
}
module.exports = Component;

