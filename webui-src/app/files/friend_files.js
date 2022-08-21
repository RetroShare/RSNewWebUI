const m = require('mithril');
const rs = require('rswebui');

const Directories = () => {
  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {});
      const res2 = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
        handle: res.body.details.children[0].handle.xint64,
      });
    },
  };
};
const Layout = () => {
  return {
    view: (v) => [m('.widget', [m('h3', 'Friends Files'), m(Directories)])],
  };
};

module.exports = Layout;
