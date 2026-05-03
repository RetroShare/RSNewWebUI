const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');

const Uploads = {
  statusMap: {},
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest('/rsFiles/FileUploads', {}, (d) => (Uploads.hashes = d.hashs));
  },

  loadStatus() {
    Uploads.loadHashes();
    const fileKeys = Object.keys(Uploads.statusMap);
    if (Uploads.hashes.length !== fileKeys.length) {
      if (Uploads.hashes.length > fileKeys.length) {
        const newHashes = util.compareArrays(Uploads.hashes, fileKeys);
        for (const hash of newHashes) {
          Uploads.updateFileDetail(hash, true);
        }
      } else {
        const oldHashes = util.compareArrays(fileKeys, Uploads.hashes);
        for (const hash of oldHashes) {
          delete Uploads.statusMap[hash];
        }
      }
    }
    for (const hash in Uploads.statusMap) {
      Uploads.updateFileDetail(hash);
    }
  },
  updateFileDetail(hash, isNew = false) {
    rs.rsJsonApiRequest(
      '/rsFiles/FileDetails',
      {
        hash,
        hintflags: 32, // RS_FILE_HINTS_UPLOAD
      },
      (fileStat) => {
        if (!fileStat.retval) {
          console.error('Error: Unknown hash in Uploads: ', hash);
          return;
        }
        fileStat.info.isSearched = isNew ? true : Uploads.statusMap[hash].isSearched;
        Uploads.statusMap[hash] = fileStat.info;
      }
    );
  },
};

function averageOf(peers) {
  return peers.reduce((s, e) => s + e.transfered.xint64, 0) / peers.length;
}

const UploadsView = () => {
  return {
    oninit: () =>
      rs.setBackgroundTask(Uploads.loadStatus, 1000, () => {
        return m.route.get() === '/files/uploads';
      }),
    view: () => [
      m('.widget__heading', [m('h3', 'Uploads'), m('span.counter', Uploads.hashes.length)]),
      m('.widget__body', [
        Uploads.hashes.length > 0
          ? m('.widget', [
              Object.keys(Uploads.statusMap).map((hash) =>
                m(util.File, {
                  info: Uploads.statusMap[hash],
                  direction: 'up',
                  transferred: averageOf(Uploads.statusMap[hash].peers),
                  parts: Uploads.statusMap[hash].peers.reduce(
                    (a, e) => [...a, e.transfered.xint64],
                    []
                  ),
                })
              ),
            ])
          : m('p', 'No active uploads'),
      ]),
    ],
  };
};

module.exports = {
  Component: UploadsView,
  list: Uploads.statusMap,
};