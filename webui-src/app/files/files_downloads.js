let m = require('mithril');
let rs = require('rswebui');
let util = require('files_util')


function updateFileDetail(hash, isNew = false) {
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
          updateFileDetail(hash, true);
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
      updateFileDetail(hash);
    }
  },
};

function addFile(url) {
  // valid url format: retroshare://file?name=...&size=...&hash=...
  let details = m.parseQueryString(url.split('?')[1]);
  // TODO check for invalid url
  rs.rsJsonApiRequest('/rsFiles/FileRequest', {
    fileName: details.name,
    hash: details.hash,
    size: Number.parseInt(details.size),
  }, (status) => {
    rs.popupMessage([
      m('i.fas.fa-file-medical'),
      m('h3', 'Add new file'),
      m('hr'),
      m('p', status ? 'Successfully added file!' :
        'Error: could not add file'),
    ]);
  })
};

NewFileDialog = () => {
  let url = '';
  return {
    view: () => [
      m('i.fas.fa-file-medical'),
      m('h3', 'Add new file'),
      m('hr'),
      m('p', 'Enter the file link:'),
      m('input[type=text][name=fileurl]', {
        onchange: (e) => url = e.target.value,
      }),
      m('button', {
        onclick: () => addFile(url),
      }, 'Add'),
    ],
  };
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
      m('button', {
        onclick: () => rs.popupMessage(m(NewFileDialog)),
      }, 'Add new file'),
      m('button', {
        onclick: () => rs.rsJsonApiRequest(
          '/rsFiles/FileClearCompleted'),
      }, 'Clear completed'),
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

