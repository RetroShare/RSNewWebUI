const m = require('mithril');

const Channel = () => {
  return {
    view: () => m('.channel'),
  };
};

const MyChannels = () => {
  return {
    view: () => m('.widget', [m('h3', 'My channels'), m('hr'), m(Channel)]),
  };
};

const Layout = () => {
  return {
    view: (vnode) => m('.tab-page', [m(MyChannels)]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
