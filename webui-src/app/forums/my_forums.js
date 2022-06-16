const m = require('mithril');

const Layout = () => {
  return {
    view: () => [m('.widget', [m('h2', 'My Forums'), m('hr')])],
  };
};

module.exports = Layout();
