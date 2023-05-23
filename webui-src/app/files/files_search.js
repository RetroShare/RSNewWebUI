const m = require('mithril');
const rs = require('rswebui');
const futil = require('files/files_util');
const widget = require('widgets');

let matchString = '';
const reqObj = {};
let currentItem = 0;

async function handleSubmit() {
  await rs
    .rsJsonApiRequest('/rsFiles/turtleSearch', { matchString })
    .then((res) => {
      reqObj[res.body.retval] = matchString;
      currentItem = res.body.retval;
    })
    .catch((error) => console.log(error));
}

const SearchBar = () => {
  return {
    view: () =>
      m(
        'form',
        {
          onsubmit: handleSubmit,
        },
        [
          m('input[type=text][placeholder=search]', {
            value: matchString,
            oninput: (e) => (matchString = e.target.value),
          }),
          m('button[type=submit]', 'Submit'),
        ]
      ),
  };
};

const Layout = () => {
  let active = 0;
  return {
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Search'),
        m('hr'),
        m(SearchBar),
        m('div.file-search-container', [
          m('div.file-search-container__keywords', [
            m('h4', 'Keywords'),
            m(
              'div.keywords-container',
              Object.keys(reqObj)
                .sort((a, b) => reqObj[a] > reqObj[b])
                .map((item, index) => {
                  return m(
                    m.route.Link,
                    {
                      class: active === index ? 'selected' : '',
                      onclick: () => {
                        active = index;
                        currentItem = item;
                      },
                      href: '/files/search/' + item,
                    },
                    reqObj[item]
                  );
                })
            ),
          ]),
          m('div.file-search-container__results', [
            Object.keys(futil.proxyObj).length === 0
              ? m('h4', 'Results')
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
                    futil.proxyObj[currentItem] === undefined &&
                      futil.proxyObj[currentItem].length === 0
                      ? 'Fetching Results...'
                      : futil.proxyObj[currentItem].map((item) =>
                          m('tr', [
                            m('td.results__name', [m('i.fas.fa-file'), m('span', item.fName)]),
                            m('td.results__size', futil.makeFriendlyUnit(item.fSize.xstr64)),
                            m('td.results__hash', item.fHash),
                            m(
                              'td.results__download',
                              m(
                                'button',
                                {
                                  onclick: () => {
                                    try {
                                      rs.rsJsonApiRequest(
                                        '/rsFiles/FileRequest',
                                        {
                                          fileName: item.fName,
                                          hash: item.fHash,
                                          flags: futil.RS_FILE_REQ_ANONYMOUS_ROUTING,
                                          size: {
                                            xstr64: item.fSize.xstr64,
                                          },
                                        },
                                        (status) => {
                                          status.retval
                                            ? widget.popupMessage([
                                                m('i.fas.fa-file-medical'),
                                                m('h3', 'File is being downloaded!'),
                                              ])
                                            : widget.popupMessage([
                                                m('i.fas.fa-file-medical'),
                                                m('h3', 'File is already downloaded!'),
                                              ]);
                                        }
                                      );
                                    } catch (error) {
                                      console.log('error in sending download request: ', error);
                                    }
                                  },
                                },
                                'Download'
                              )
                            ),
                          ])
                        )
                  ),
                ]),
          ]),
        ]),
      ]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
