const m = require('mithril');
const rs = require('rswebui');
const futil = require('files/files_util');

let matchString = '';
const reqObj = {};

async function handleSubmit() {
  await rs
    .rsJsonApiRequest('/rsFiles/turtleSearch', { matchString })
    .then((res) => {
      reqObj[res.body.retval] = matchString;
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
  console.log(futil.proxyObj, Object.keys(reqObj));
  setTimeout(() => {
    console.log(futil.proxyObj, Object.keys(reqObj));
  }, 30000);
  let active = 0;
  let currentItem = 0;
  return {
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Search'),
        m('hr'),
        m(SearchBar),
        m(
          'div.file-search',
          m('div.file-search-container', [
            m('div.file-search-container__search-terms', [
              m('h4', 'Search Terms'),
              m(
                'div.search-terms-container',
                Object.keys(reqObj).map((item, index) => {
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
            m('div.file-search-container__search-results', [
              m('h4', 'Search Results'),
              Object.keys(futil.proxyObj).length === 0
                ? m('p', 'Nothing Searched')
                : m(
                    'div.search-results-container',
                    futil.proxyObj[currentItem] === undefined &&
                      futil.proxyObj[currentItem].length === 0
                      ? 'Fetching Results...'
                      : futil.proxyObj[currentItem].map((item) => m('p', item.fName))
                  ),
            ]),
          ])
        ),
      ]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
