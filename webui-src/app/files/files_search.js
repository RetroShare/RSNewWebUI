const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const futil = require('files/files_util');
const fproxy = require('files/files_proxy');

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
      m('form.search-form', {
        onsubmit: (event) => {
          event.preventDefault();
          handleSubmit();
        },
      }, [
        m('input[type=text][placeholder=Search files]', {
          value: matchString,
          oninput: (e) => (matchString = e.target.value),
        }),
        m('button[type=submit]', m('i.fas.fa-search')),
      ]),
  };
};

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'i.fas.fa-file-pdf';
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
    case '7z': return 'i.fas.fa-file-archive';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif': return 'i.fas.fa-file-image';
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov': return 'i.fas.fa-file-video';
    case 'mp3':
    case 'wav':
    case 'flac': return 'i.fas.fa-file-audio';
    case 'txt':
    case 'doc':
    case 'docx': return 'i.fas.fa-file-alt';
    default: return 'i.fas.fa-file';
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
        widget.popupMessage(
          m('.widget', [
            m('.widget__heading', m('h3', m('i.fas.fa-file-medical'), ' File Download')),
            m(
              '.widget__body',
              m('p', `File is ${res.body.retval ? 'getting' : 'already'} downloaded.`)
            ),
          ])
        );
      })
      .catch((error) => {
        // console.log('error in sending download request: ', error);
      });
  }
  return {
    view: () => [
      m('.widget__heading', [m('h3', 'Search'), m(SearchBar)]),
      m('.widget__body', [
        m('div.file-search-container', [
          m('div.file-search-container__keywords', [
            m('.keywords-header', [
              m('h5.bold', 'Keywords'),
              m(
                'button.red.clear-btn',
                {
                  onclick: () => {
                    Object.keys(reqObj).forEach((key) => delete reqObj[key]);
                    Object.keys(fproxy.fileProxyObj).forEach((key) => delete fproxy.fileProxyObj[key]);
                    currentItem = 0;
                    active = 0;
                  },
                },
                'Clear'
              ),
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
              ? m('h5.bold', 'Results')
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
                          m(getFileIcon(item.fName)),
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
                          m(
                            'button.download-btn-v65',
                            { onclick: () => handleFileDownload(item) },
                            'Download'
                          )
                        ),
                      ])
                    )
                    : 'No Results.'
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
