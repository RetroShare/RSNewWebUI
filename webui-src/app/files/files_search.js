const m = require('mithril');
const rs = require('rswebui');
const futil = require('files/files_util');
const fproxy = require('files/files_proxy');
const icon = require('icon');
const toast = require('toast');
const widget = require('widgets');

let matchString = '';
let currentItem = 0;
const reqObj = {};

function handleSubmit() {
  rs.rsJsonApiRequest('/rsFiles/turtleSearch', { matchString })
    .then((res) => {
      // Add prefix to obj keys so that javascript doesn't sort them
      reqObj['_' + res.body.retval] = matchString;
      currentItem = '_' + res.body.retval;
    })
    .catch((error) => { });
}

const SearchBar = () => {
  return {
    view: () =>
      m(widget.SearchField, {
        class: 'search-form',
        placeholder: 'Search files',
        value: matchString,
        oninput: (e) => (matchString = e.target.value),
        onSubmit: handleSubmit,
      }),
  };
};

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'file-pdf';
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
    case '7z': return 'file-archive';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif': return 'file-image';
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov': return 'file-video';
    case 'mp3':
    case 'wav':
    case 'flac': return 'file-audio';
    case 'txt':
    case 'doc':
    case 'docx': return 'file-alt';
    default: return 'file';
  }
};

const Layout = () => {
  let active = 0;
  function handleFileDownload(item) {
    rs.rsJsonApiRequest('/rsFiles/FileRequest', {
      fileName: item.fName,
      hash: item.fHash,
      flags: futil.RS_FILE_REQ_ANONYMOUS_ROUTING,
      size: {
        xstr64: item.fSize.xstr64,
      },
    })
      .then((res) => {
        toast.info(res.body.retval ? 'Download started' : 'Already downloading');
      })
      .catch((error) => {
        // console.log('error in sending download request: ', error);
      });
  }
  return {
    view: () => [
      m(widget.PageHead, {
        title: 'Search',
        lead: 'Ask the network for files by name. Results arrive as peers answer.',
        actions: m(SearchBar),
      }),
      m('.widget__body', [
        //  Nothing has been asked for yet: the two-pane split with an empty
        //  Keywords list and a bare "Results" heading said nothing about what
        //  to do next.
        Object.keys(reqObj).length === 0
          ? m('.empty', [
            icon('search', { size: 28 }),
            m('b', 'No searches yet'),
            m('span', 'Type a file name above and press Search. Results arrive as '
              + 'peers answer, so they can take a moment to appear.'),
          ])
          : m('div.file-search-container', [
          m('div.file-search-container__keywords', [
            m('.keywords-header', [
              m('h5', 'Keywords'),
              m(
                'button.red.clear-btn',
                {
                  onclick: () => {
                    Object.keys(reqObj).forEach((key) => delete reqObj[key]);
                    Object.keys(fproxy.fileProxyObj).forEach((key) => delete fproxy.fileProxyObj[key]);
                    currentItem = 0;
                    active = 0;
                  },
                }, [icon('eraser'), 'Clear']),
            ]),
            Object.keys(reqObj).length !== 0 &&
            m(
              'div.keywords-container',
              Object.keys(reqObj)
                .reverse()
                .map((item, index) => {
                  return m(
                    m.route.Link,
                    {
                      class: active === index ? 'selected' : '',
                      onclick: () => {
                        active = index;
                        currentItem = item;
                      },
                      href: `/files/search/${item}`,
                    },
                    reqObj[item]
                  );
                })
            ),
          ]),
          m('div.file-search-container__results', [
            Object.keys(fproxy.fileProxyObj).length === 0 || currentItem === 0
              ? m('.empty', [
                icon('search', { size: 24 }),
                m('b', 'Waiting for answers'),
                m('span', 'Peers reply as they find matches. Pick a search on the '
                  + 'left to see what has come back.'),
              ])
              : m('div.results-container', [
                m(
                  'div.results-header',
                  m('.results-row', [
                    m('.results-cell.name-col', 'Name'),
                    m('.results-cell.size-col', 'Size'),
                    m('.results-cell.hash-col', 'Hash'),
                    m('.results-cell.action-col', 'Download'),
                  ])
                ),
                m(
                  'div.results-list',
                  fproxy.fileProxyObj[currentItem.slice(1)]
                    ? fproxy.fileProxyObj[currentItem.slice(1)].map((item) =>
                      m('div.results-row.file-item', [
                        m('.results-cell.name-col', { 'data-label': 'Name' }, [
                          icon(getFileIcon(item.fName)),
                          m('span', item.fName),
                        ]),
                        m(
                          '.results-cell.size-col',
                          { 'data-label': 'Size' },
                          rs.formatBytes((item.fSize && (item.fSize.xint64 || item.fSize.xstr64)) || 0)
                        ),
                        m('.results-cell.hash-col', { 'data-label': 'Hash' }, item.fHash),
                        m(
                          '.results-cell.action-col',
                          m('button.download-btn-v65.is-primary',
                            { onclick: () => handleFileDownload(item) }, [icon('download'), 'Download'])
                        ),
                      ])
                    )
                    : m('.empty', [
                      m('b', 'No matches'),
                      m('span', 'No peer has answered with a file by that name.'),
                    ])
                ),
              ]),
          ]),
        ]),
      ]),
    ],
  };
};

module.exports = {
  view: () => m(Layout),
};
