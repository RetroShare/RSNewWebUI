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
    .catch((error) => console.log(error));
}

const SearchBar = () => {
  return {
    view: () =>
      m('form.search-form', { onsubmit: handleSubmit }, [
        m('input[type=text][placeholder=search keyword]', {
          value: matchString,
          oninput: (e) => (matchString = e.target.value),
        }),
        m('button[type=submit]', m('i.fas.fa-search')),
      ]),
  };
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
        console.log('error in sending download request: ', error);
      });
  }
  return {
    view: () => [
      m('.widget__heading', [m('h3', 'Search'), m(SearchBar)]),
      m('.widget__body', [
        m('div.file-search-container', [
          m('div.file-search-container__keywords', [
            m('h5.bold', 'Keywords'),
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
            Object.keys(fproxy.fileProxyObj).length === 0
              ? m('h5.bold', 'Results')
              : m('table.results-container', [
                  m(
                    'thead.results-header',
                    m('tr', [
                      m('th', 'Name'),
                      m('th', 'Size'),
                      m('th', 'Hash'),
                      m('th', 'Download'),
                    ])
                  ),
                  m(
                    'tbody.results',
                    fproxy.fileProxyObj[currentItem.slice(1)]
                      ? fproxy.fileProxyObj[currentItem.slice(1)].map((item) =>
                          m('tr', [
                            m('td.results__name', [m('i.fas.fa-file'), m('span', item.fName)]),
                            m('td.results__size', rs.formatBytes(item.fSize.xint64)),
                            m('td.results__hash', item.fHash),
                            m(
                              'td.results__download',
                              m('button', { onclick: () => handleFileDownload(item) }, 'Download')
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
