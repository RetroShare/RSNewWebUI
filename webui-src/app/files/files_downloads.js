let m = require('mithril');
let rs = require('rswebui');
let util = require('files_util')


function setHashDetail(hash, isNew = false) {
  rs.rsJsonApiRequest(
    '/rsFiles/FileDetails', {
      hash,
      hintflags: 16, // RS_FILE_HINTS_DOWNLOAD
    },
    (fileStat) => {
      if(!fileStat.retval) {
        console.error('Error: Unknown hash in Downloads: ', hash);
        return;
      }
      fileStat.info.isSearched = (isNew ?
        true :
        Downloads.statusMap[hash].isSearched);
      Downloads.statusMap[hash] = fileStat.info;
    },
  );
}

let Downloads = {
  statusMap: {},
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest(
      '/rsFiles/FileDownloads', {},
      (d) => Downloads.hashes = d.hashs,
    );
  },

  loadStatus() {
    Downloads.loadHashes();
    let fileKeys = Object.keys(Downloads.statusMap);
    if(Downloads.hashes.length !== fileKeys.length) {
      // New file added
      if(Downloads.hashes.length > fileKeys.length) {
        let newHashes = util.compareArrays(Downloads.hashes, fileKeys);
        for(let hash of newHashes) {
          setHashDetail(hash, true);
        }
      }
      // Existing file removed
      else {
        let oldHashes = util.compareArrays(fileKeys, Downloads.hashes);
        for(let hash of oldHashes) {
          delete Downloads.statusMap[hash];
        }
      }
    }
    for(let hash in Downloads.statusMap) {
      setHashDetail(hash);
    }
  },
};

const Component = () => {
  return {
    oninit: () => rs.setBackgroundTask(
      Downloads.loadStatus,
      1000,
      () => {
        return (m.route.get() === '/files')
      }
    ),
    view: () => m('.widget', [
      m('h3', 'Downloads'),
      m('hr'),
      Object.keys(Downloads.statusMap).map(
        (hash) => m(util.File, {
          info: Downloads.statusMap[hash]
        })),
    ]),
  };
};

module.exports = {
  Component,
  list: Downloads.statusMap
};

