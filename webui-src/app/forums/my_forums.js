const m = require('mithril');
const util = require('forums/forums_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'My Forums')),
      m('.widget__body', [
        m(
          util.ForumTable,
          m('tbody', [
            v.attrs.list.map((forum) =>
              m(util.ForumSummary, {
                details: forum,
                category: 'MyForums',
              })
            ),
            v.attrs.list.map((forum) =>
              m(util.DisplayForumsFromList, {
                id: forum.mGroupId,
                category: 'MyForums',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
