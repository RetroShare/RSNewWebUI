const m = require('mithril');
const rs = require('rswebui');
// const util = require('files/files_util');

let matchString = '';
const SearchBar = () => {
  return {
    view: () =>
      m('input[type=text][placeholder=search]', {
        value: matchString,
        oninput: (e) => (matchString = e.target.value),
        onchange: (e) => {
          console.log('searching for string: ', matchString);
          // let source = new EventSource(
          //  'http://127.0.0.1:9092/rsFiles/turtleSearchRequest', {
          //    withCredentials: true
          //  });
          rs.rsJsonApiRequest(
            '/rsfiles/turtleSearchRequest',
            {
              matchString,
            },
            (data, stat) => {
              console.log('got: ', stat, ' data: ', data);
            }
          );
        },
      }),
  };
};

const Layout = () => {
  return {
    view: (vnode) => m('.widget', [m('h3', 'Search'), m('hr'), m(SearchBar)]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
