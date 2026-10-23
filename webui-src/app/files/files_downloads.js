const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');
const icon = require('icon');
const toast = require('toast');

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
  toast.info('Error: could not add file');
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
      widget.closePopupMessage();
      toast.success('Successfully added file!');
    }
  );
}

const NewFileDialog = () => {
  let url = '';
  return {
    view: () =>
      m(
        'form.add-file-dialog',
        {
          onsubmit: (event) => {
            event.preventDefault();
            addFile(url);
          },
        },
        [
          m('label[for=new-file-url]', 'Enter the file link:'),
          m('input#new-file-url[type=text][name=fileurl]', {
            placeholder: 'retroshare://file?name=...',
            value: url,
            oninput: (e) => (url = e.target.value),
          }),
          m('.modal__foot', [
            m('button[type=button]', { onclick: () => widget.closePopupMessage() }, [icon('times'), 'Cancel']),
            m('button[type=submit]', 'Add file'),
          ]),
        ]
      ),
  };
};

const Component = () => {
  function clearFileCompleted() {
    rs.rsJsonApiRequest('/rsFiles/FileClearCompleted');
  }
  return {
    oninit: () => {
      Downloads.loadStrategy();
      rs.setBackgroundTask(Downloads.loadStatus, 1000, () => m.route.get() === '/files/files');
      Downloads.resetSearch();
    },
    view: () => [
      //  Title left, actions right: the inline flex-column above stacked the
      //  buttons over the heading, so they read as loose page furniture
      //  rather than as the actions belonging to this section.
      m('.widget__body-heading', [
        m('h3', `Downloads (${Downloads.hashes ? Downloads.hashes.length : 0} files)`),
        m('.action', [
          m(
            'button.is-primary',
            { onclick: () => widget.popupMessage(m(NewFileDialog), 'add-file-modal', { title: 'Add a file' }) },
            [icon('plus'), 'Add new file']
          ),
          m('button', { onclick: clearFileCompleted }, [icon('eraser'), 'Clear completed']),
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
  addFile,
  Component,
  Downloads,
  list: Downloads.statusMap,
};
