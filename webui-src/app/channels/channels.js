let m = require('mithril');
let rs = require('rswebui');


let Channel = () => {
  return {
    view: () => m('.channel'),
  };
};

let MyChannels = () => {
  return {
    view: () => m('.widget', [
      m('h3', 'My channels'),
      m('hr'),
      m(Channel),
    ])
  };
};

const Layout = () => {
  return {
    view: vnode => m('.tab-page', [
      m(MyChannels),
    ]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

