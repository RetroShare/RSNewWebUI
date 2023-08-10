const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');

const Downloads = {
  strategies: {},
  statusMap: {},
  hashes: [],
  chunksMap: {},

  loadStrategy() {
    rs.rsJsonApiRequest('/rsFiles/FileDownloads', {}, (d) =>
      d.hashs.map((hash) => {
        rs.rsJsonApiRequest('/rsFiles/getChunkStrategy', { hash }).then((res) => {
          if (res.body.retval) Downloads.strategies[hash] = res.body.s;
        });
      })
    );
  },

  async loadHashes() {
    await rs
      .rsJsonApiRequest('/rsFiles/FileDownloads', {}, (d) => (Downloads.hashes = d.hashs))
      .then(() => {
        Downloads.hashes.forEach((hash) => {
          rs.rsJsonApiRequest('/rsFiles/FileDownloadChunksDetails', {
            hash,
          }).then((res) => (this.chunksMap[hash] = res.body.info));
        });
      });
  },

  async loadStatus() {
    await Downloads.loadHashes();
    const fileKeys = Object.keys(Downloads.statusMap);
    if (Downloads.hashes !== undefined && Downloads.hashes.length !== fileKeys.length) {
      if (Downloads.hashes.length > fileKeys.length) {
        // New file added
        const newHashes = util.compareArrays(Downloads.hashes, fileKeys);
        for (const hash of newHashes) {
          Downloads.updateFileDetail(hash, true);
        }
      } else {
        // Existing file removed
        const oldHashes = util.compareArrays(fileKeys, Downloads.hashes);
        for (const hash of oldHashes) {
          delete Downloads.statusMap[hash];
        }
      }
    }
    for (const hash in Downloads.statusMap) {
      Downloads.updateFileDetail(hash);
    }
  },
  resetSearch() {
    for (const hash in Downloads.statusMap) {
      Downloads.statusMap[hash].isSearched = true;
    }
  },
  updateFileDetail(hash, isNew = false) {
    rs.rsJsonApiRequest(
      '/rsFiles/FileDetails',
      {
        hash,
        hintflags: 16, // RS_FILE_HINTS_DOWNLOAD
      },
      (fileStat) => {
        if (!fileStat.retval) {
          console.error('Error: Unknown hash in Downloads: ', hash);
          return;
        }
        fileStat.info.isSearched = isNew ? true : Downloads.statusMap[hash].isSearched;
        Downloads.statusMap[hash] = fileStat.info;
      }
    );
  },
};

function InvalidFileMessage() {
  widget.popupMessage([
    m('i.fas.fa-file-medical'),
    m('h3', 'Add new file'),
    m('hr'),
    m('p', 'Error: could not add file'),
  ]);
}

function addFile(url) {
  // valid url format: retroshare://file?name=...&size=...&hash=...
  if (!url.startsWith('retroshare://')) {
    InvalidFileMessage();
    return;
  }
  const details = m.parseQueryString(url.split('?')[1]);
  if (
    !Object.prototype.hasOwnProperty.call(details, 'name') ||
    !Object.prototype.hasOwnProperty.call(details, 'size') ||
    !Object.prototype.hasOwnProperty.call(details, 'hash')
  ) {
    InvalidFileMessage();
    return;
  }
  rs.rsJsonApiRequest(
    '/rsFiles/FileRequest',
    {
      fileName: details.name,
      hash: details.hash,
      flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
      size: {
        xstr64: details.size,
      },
    },
    (status) => {
      widget.popupMessage([
        m('i.fas.fa-file-medical'),
        m('h3', 'Add new file'),
        m('hr'),
        m('p', 'Successfully added file!'),
      ]);
    }
  );
}

const NewFileDialog = () => {
  let url = '';
  return {
    view: () => [
      m('i.fas.fa-file-medical'),
      m('h3', 'Add new file'),
      m('hr'),
      m('p', 'Enter the file link:'),
      m('input[type=text][name=fileurl]', {
        onchange: (e) => (url = e.target.value),
      }),
      m('button', { onclick: () => addFile(url) }, 'Add'),
    ],
  };
};

const Component = () => {
  return {
    oninit: () => {
      Downloads.loadStrategy();
      rs.setBackgroundTask(Downloads.loadStatus, 1000, () => m.route.get() === '/files/files');
      Downloads.resetSearch();
    },
    view: () => [
      m('.widget__body-heading', [
        m('h3', `Downloads (${Downloads.hashes ? Downloads.hashes.length : 0} files)`),
        m('.action', [
          m('button', { onclick: () => widget.popupMessage(m(NewFileDialog)) }, 'Add new file'),
          m(
            'button',
            { onclick: () => rs.rsJsonApiRequest('/rsFiles/FileClearCompleted') },
            'Clear completed'
          ),
        ]),
      ]),
      m('.widget__body-content', [
        Downloads.statusMap &&
          Object.keys(Downloads.statusMap).map((hash) =>
            m(util.File, {
              info: Downloads.statusMap[hash],
              strategy: Downloads.strategies[hash],
              direction: 'down',
              transferred: Downloads.statusMap[hash].transfered.xint64,
              chunksInfo: Downloads.chunksMap[hash],
            })
          ),
      ]),
    ],
  };
};

module.exports = {
  Component,
  Downloads,
  list: Downloads.statusMap,
};
