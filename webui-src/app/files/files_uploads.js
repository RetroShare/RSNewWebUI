let m = require('mithril');
let rs = require('rswebui');
let util = require('files_util')


function updateFileDetail(hash, isNew = false) {
  rs.rsJsonApiRequest(
    '/rsFiles/FileDetails', {
      hash,
      hintflags: 32, // RS_FILE_HINTS_UPLOAD
    },
    (fileStat) => {
      if(!fileStat.retval) {
        console.error('Error: Unknown hash in Uploads: ', hash);
        return;
      }
      fileStat.info.isSearched = (isNew ?
        true :
        Uploads.statusMap[hash].isSearched);
      Uploads.statusMap[hash] = fileStat.info;
    },
  );
}

let Uploads = {
  statusMap: {},
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest(
      '/rsFiles/FileUploads', {},
      (d) => Uploads.hashes = d.hashs,
    );
  },

  loadStatus() {
    Uploads.loadHashes();
    let fileKeys = Object.keys(Uploads.statusMap);
    if(Uploads.hashes.length !== fileKeys.length) {
      // New file added
      if(Uploads.hashes.length > fileKeys.length) {
        let newHashes = util.compareArrays(Uploads.hashes, fileKeys);
        for(let hash of newHashes) {
          updateFileDetail(hash, true);
        }
      }
      // Existing file removed
      else {
        let oldHashes = util.compareArrays(fileKeys, Uploads.hashes);
        for(let hash of oldHashes) {
          delete Uploads.statusMap[hash];
        }
      }
    }
    for(let hash in Uploads.statusMap) {
      updateFileDetail(hash);
    }
  },
};

const Component = () => {
  return {
    oninit: () => rs.setBackgroundTask(
      Uploads.loadStatus,
      1000,
      () => {
        return (m.route.get() === '/files')
      }
    ),
    view: () => m('.widget', [
      m('h3', 'Uploads'),
      m('hr'),
      Object.keys(Uploads.statusMap).map(
        (hash) => m(util.File, {
          info: Uploads.statusMap[hash]
        })),
    ]),
  };
};

module.exports = {
  Component,
  list: Uploads.statusMap
};

