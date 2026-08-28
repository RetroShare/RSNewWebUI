const m = require('mithril');
const util = require('forums/forums_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'Subscribed Forums')),
      m('.widget__body', [
        m(
          util.ForumTable,
          m('tbody', [
            v.attrs.list.map((forum) =>
              m(util.ForumSummary, {
                details: forum,
                category: 'Subscribed',
              })
            ),
            v.attrs.list.map((forum) =>
              m(util.DisplayForumsFromList, {
                id: forum.mGroupId,
                category: 'Subscribed',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
